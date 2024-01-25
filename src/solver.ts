import {Constraint, Operator} from './constraint.js'
import {Expression} from './expression.js'
import {createMap, IMap} from './maptype.js'
import {Strength} from './strength.js'
import {Variable} from './variable.js'

/**
 * The constraint solver class.
 *
 * @class
 */
export class Solver {
	/**
	 * @type {number} - The max number of solver iterations before an error
	 * is thrown, in order to prevent infinite iteration. Default: `10,000`.
	 */
	public maxIterations = 1000

	/**
	 * Construct a new Solver.
	 */
	constructor() {}

	/**
	 * Creates and add a constraint to the solver.
	 *
	 * @param {Expression|Variable} lhs Left hand side of the expression
	 * @param {Operator} operator Operator
	 * @param {Expression|Variable|Number} rhs Right hand side of the expression
	 * @param {Number} [strength=Strength.required] Strength
	 */
	public createConstraint(
		lhs: Expression | Variable,
		operator: Operator,
		rhs: Expression | Variable | number,
		strength: number = Strength.required,
	): Constraint {
		let cn = new Constraint(lhs, operator, rhs, strength)
		this.addConstraint(cn)
		return cn
	}

	/**
	 * Add a constraint to the solver.
	 *
	 * @param {Constraint} constraint Constraint to add to the solver
	 */
	public addConstraint(constraint: Constraint): void {
		let cnPair = this._cnMap.find(constraint)
		if (cnPair !== undefined) {
			throw new Error('duplicate constraint')
		}

		// Creating a row causes symbols to be reserved for the variables
		// in the constraint. If this method exits with an exception,
		// then its possible those variables will linger in the var map.
		// Since its likely that those variables will be used in other
		// constraints and since exceptional conditions are uncommon,
		// i'm not too worried about aggressive cleanup of the var map.
		let data = this._createRow(constraint)
		let row = data.row
		let tag = data.tag
		let subject = this._chooseSubject(row, tag)

		// If chooseSubject couldnt find a valid entering symbol, one
		// last option is available if the entire row is composed of
		// dummy variables. If the constant of the row is zero, then
		// this represents redundant constraints and the new dummy
		// marker can enter the basis. If the constant is non-zero,
		// then it represents an unsatisfiable constraint.
		if (subject.type() === SymbolType.Invalid && row.allDummies()) {
			if (!nearZero(row.constant())) {
				throw new Error('unsatisfiable constraint')
			} else {
				subject = tag.marker
			}
		}

		// If an entering symbol still isn't found, then the row must
		// be added using an artificial variable. If that fails, then
		// the row represents an unsatisfiable constraint.
		if (subject.type() === SymbolType.Invalid) {
			if (!this._addWithArtificialVariable(row)) {
				throw new Error('unsatisfiable constraint')
			}
		} else {
			row.solveFor(subject)
			this._substitute(subject, row)
			this._rowMap.insert(subject, row)
		}

		this._cnMap.insert(constraint, tag)

		// Optimizing after each constraint is added performs less
		// aggregate work due to a smaller average system size. It
		// also ensures the solver remains in a consistent state.
		this._optimize(this._objective)
	}

	/**
	 * Remove a constraint from the solver.
	 *
	 * @param {Constraint} constraint Constraint to remove from the solver
	 */
	public removeConstraint(constraint: Constraint): void {
		let cnPair = this._cnMap.erase(constraint)
		if (cnPair === undefined) {
			throw new Error('unknown constraint')
		}

		// Remove the error effects from the objective function
		// *before* pivoting, or substitutions into the objective
		// will lead to incorrect solver results.
		this._removeConstraintEffects(constraint, cnPair.second)

		// If the marker is basic, simply drop the row. Otherwise,
		// pivot the marker into the basis and then drop the row.
		let marker = cnPair.second.marker
		let rowPair = this._rowMap.erase(marker)
		if (rowPair === undefined) {
			let leaving = this._getMarkerLeavingSymbol(marker)
			if (leaving.type() === SymbolType.Invalid) {
				throw new Error('failed to find leaving row')
			}
			rowPair = this._rowMap.erase(leaving)
			rowPair.second.solveForEx(leaving, marker)
			this._substitute(marker, rowPair.second)
		}

		// Optimizing after each constraint is removed ensures that the
		// solver remains consistent. It makes the solver api easier to
		// use at a small tradeoff for speed.
		this._optimize(this._objective)
	}

	/**
	 * Test whether the solver contains the constraint.
	 *
	 * @param {Constraint} constraint Constraint to test for
	 * @return {Bool} true or false
	 */
	public hasConstraint(constraint: Constraint): boolean {
		return this._cnMap.contains(constraint)
	}

	/**
	 * Get an array of the current constraints.
	 *
	 * @return {Constraint[]}
	 */
	public getConstraints(): Constraint[] {
		return this._cnMap.array.map(({first}) => first)
	}

	/**
	 * Add an edit variable to the solver.
	 *
	 * @param {Variable} variable Edit variable to add to the solver
	 * @param {Number} strength Strength, should be less than `Strength.required`
	 */
	public addEditVariable(variable: Variable, strength: number): void {
		let editPair = this._editMap.find(variable)
		if (editPair !== undefined) {
			throw new Error('duplicate edit variable')
		}
		strength = Strength.clip(strength)
		if (strength === Strength.required) {
			throw new Error('bad required strength')
		}
		let expr = new Expression(variable)
		let cn = new Constraint(expr, Operator.Eq, undefined, strength)
		this.addConstraint(cn)
		let tag = this._cnMap.find(cn).second
		let info = {tag, constraint: cn, constant: 0.0}
		this._editMap.insert(variable, info)
	}

	/**
	 * Remove an edit variable from the solver.
	 *
	 * @param {Variable} variable Edit variable to remove from the solver
	 */
	public removeEditVariable(variable: Variable): void {
		let editPair = this._editMap.erase(variable)
		if (editPair === undefined) {
			throw new Error('unknown edit variable')
		}
		this.removeConstraint(editPair.second.constraint)
	}

	/**
	 * Test whether the solver contains the edit variable.
	 *
	 * @param {Variable} variable Edit variable to test for
	 * @return {Bool} true or false
	 */
	public hasEditVariable(variable: Variable): boolean {
		return this._editMap.contains(variable)
	}

	/**
	 * Suggest the value of an edit variable.
	 *
	 * @param {Variable} variable Edit variable to suggest a value for
	 * @param {Number} value Suggested value
	 */
	public suggestValue(variable: Variable, value: number): void {
		let editPair = this._editMap.find(variable)
		if (editPair === undefined) {
			throw new Error('unknown edit variable')
		}

		let rows = this._rowMap
		let info = editPair.second
		let delta = value - info.constant
		info.constant = value

		// Check first if the positive error variable is basic.
		let marker = info.tag.marker
		let rowPair = rows.find(marker)
		if (rowPair !== undefined) {
			if (rowPair.second.add(-delta) < 0.0) {
				this._infeasibleRows.push(marker)
			}
			this._dualOptimize()
			return
		}

		// Check next if the negative error variable is basic.
		let other = info.tag.other
		rowPair = rows.find(other)
		if (rowPair !== undefined) {
			if (rowPair.second.add(delta) < 0.0) {
				this._infeasibleRows.push(other)
			}
			this._dualOptimize()
			return
		}

		// Otherwise update each row where the error variables exist.
		for (let i = 0, n = rows.size(); i < n; ++i) {
			let rowPair = rows.itemAt(i)
			let row = rowPair.second
			let coeff = row.coefficientFor(marker)
			if (coeff !== 0.0 && row.add(delta * coeff) < 0.0 && rowPair.first.type() !== SymbolType.External) {
				this._infeasibleRows.push(rowPair.first)
			}
		}
		this._dualOptimize()
	}

	/**
	 * Update the values of the variables.
	 */
	public updateVariables(): void {
		let vars = this._varMap
		let rows = this._rowMap
		for (let i = 0, n = vars.size(); i < n; ++i) {
			let pair = vars.itemAt(i)
			let rowPair = rows.find(pair.second)
			if (rowPair !== undefined) {
				pair.first.setValue(rowPair.second.constant())
			} else {
				pair.first.setValue(0.0)
			}
		}
	}

	/**
	 * Get the symbol for the given variable.
	 *
	 * If a symbol does not exist for the variable, one will be created.
	 * @private
	 */
	private _getVarSymbol(variable: Variable): Symbol {
		let factory = () => this._makeSymbol(SymbolType.External)
		return this._varMap.setDefault(variable, factory).second
	}

	/**
	 * Create a new Row object for the given constraint.
	 *
	 * The terms in the constraint will be converted to cells in the row.
	 * Any term in the constraint with a coefficient of zero is ignored.
	 * This method uses the `_getVarSymbol` method to get the symbol for
	 * the variables added to the row. If the symbol for a given cell
	 * variable is basic, the cell variable will be substituted with the
	 * basic row.
	 *
	 * The necessary slack and error variables will be added to the row.
	 * If the constant for the row is negative, the sign for the row
	 * will be inverted so the constant becomes positive.
	 *
	 * Returns the created Row and the tag for tracking the constraint.
	 * @private
	 */
	private _createRow(constraint: Constraint): IRowCreation {
		let expr = constraint.expression()
		let row = new Row(expr.constant())

		// Substitute the current basic variables into the row.
		let terms = expr.terms()
		for (let i = 0, n = terms.size(); i < n; ++i) {
			let termPair = terms.itemAt(i)
			if (!nearZero(termPair.second)) {
				let symbol = this._getVarSymbol(termPair.first)
				let basicPair = this._rowMap.find(symbol)
				if (basicPair !== undefined) {
					row.insertRow(basicPair.second, termPair.second)
				} else {
					row.insertSymbol(symbol, termPair.second)
				}
			}
		}

		// Add the necessary slack, error, and dummy variables.
		let objective = this._objective
		let strength = constraint.strength()
		let tag = {marker: INVALID_SYMBOL, other: INVALID_SYMBOL}
		switch (constraint.op()) {
			case Operator.Le:
			case Operator.Ge: {
				let coeff = constraint.op() === Operator.Le ? 1.0 : -1.0
				let slack = this._makeSymbol(SymbolType.Slack)
				tag.marker = slack
				row.insertSymbol(slack, coeff)
				if (strength < Strength.required) {
					let error = this._makeSymbol(SymbolType.Error)
					tag.other = error
					row.insertSymbol(error, -coeff)
					objective.insertSymbol(error, strength)
				}
				break
			}
			case Operator.Eq: {
				if (strength < Strength.required) {
					let errplus = this._makeSymbol(SymbolType.Error)
					let errminus = this._makeSymbol(SymbolType.Error)
					tag.marker = errplus
					tag.other = errminus
					row.insertSymbol(errplus, -1.0) // v = eplus - eminus
					row.insertSymbol(errminus, 1.0) // v - eplus + eminus = 0
					objective.insertSymbol(errplus, strength)
					objective.insertSymbol(errminus, strength)
				} else {
					let dummy = this._makeSymbol(SymbolType.Dummy)
					tag.marker = dummy
					row.insertSymbol(dummy)
				}
				break
			}
		}

		// Ensure the row has a positive constant.
		if (row.constant() < 0.0) {
			row.reverseSign()
		}

		return {row, tag}
	}

	/**
	 * Choose the subject for solving for the row.
	 *
	 * This method will choose the best subject for using as the solve
	 * target for the row. An invalid symbol will be returned if there
	 * is no valid target.
	 *
	 * The symbols are chosen according to the following precedence:
	 *
	 * 1) The first symbol representing an external variable.
	 * 2) A negative slack or error tag variable.
	 *
	 * If a subject cannot be found, an invalid symbol will be returned.
	 *
	 * @private
	 */
	private _chooseSubject(row: Row, tag: ITag): Symbol {
		let cells = row.cells()
		for (let i = 0, n = cells.size(); i < n; ++i) {
			let pair = cells.itemAt(i)
			if (pair.first.type() === SymbolType.External) {
				return pair.first
			}
		}
		let type = tag.marker.type()
		if (type === SymbolType.Slack || type === SymbolType.Error) {
			if (row.coefficientFor(tag.marker) < 0.0) {
				return tag.marker
			}
		}
		type = tag.other.type()
		if (type === SymbolType.Slack || type === SymbolType.Error) {
			if (row.coefficientFor(tag.other) < 0.0) {
				return tag.other
			}
		}
		return INVALID_SYMBOL
	}

	/**
	 * Add the row to the tableau using an artificial variable.
	 *
	 * This will return false if the constraint cannot be satisfied.
	 *
	 * @private
	 */
	private _addWithArtificialVariable(row: Row): boolean {
		// Create and add the artificial variable to the tableau.
		let art = this._makeSymbol(SymbolType.Slack)
		this._rowMap.insert(art, row.copy())
		this._artificial = row.copy()

		// Optimize the artificial objective. This is successful
		// only if the artificial objective is optimized to zero.
		this._optimize(this._artificial)
		let success = nearZero(this._artificial.constant())
		this._artificial = null

		// If the artificial variable is basic, pivot the row so that
		// it becomes non-basic. If the row is constant, exit early.
		let pair = this._rowMap.erase(art)
		if (pair !== undefined) {
			let basicRow = pair.second
			if (basicRow.isConstant()) {
				return success
			}
			let entering = this._anyPivotableSymbol(basicRow)
			if (entering.type() === SymbolType.Invalid) {
				return false // unsatisfiable (will this ever happen?)
			}
			basicRow.solveForEx(art, entering)
			this._substitute(entering, basicRow)
			this._rowMap.insert(entering, basicRow)
		}

		// Remove the artificial variable from the tableau.
		let rows = this._rowMap
		for (let i = 0, n = rows.size(); i < n; ++i) {
			rows.itemAt(i).second.removeSymbol(art)
		}
		this._objective.removeSymbol(art)
		return success
	}

	/**
	 * Substitute the parametric symbol with the given row.
	 *
	 * This method will substitute all instances of the parametric symbol
	 * in the tableau and the objective function with the given row.
	 *
	 * @private
	 */
	private _substitute(symbol: Symbol, row: Row): void {
		let rows = this._rowMap
		for (let i = 0, n = rows.size(); i < n; ++i) {
			let pair = rows.itemAt(i)
			pair.second.substitute(symbol, row)
			if (pair.second.constant() < 0.0 && pair.first.type() !== SymbolType.External) {
				this._infeasibleRows.push(pair.first)
			}
		}
		this._objective.substitute(symbol, row)
		if (this._artificial) {
			this._artificial.substitute(symbol, row)
		}
	}

	/**
	 * Optimize the system for the given objective function.
	 *
	 * This method performs iterations of Phase 2 of the simplex method
	 * until the objective function reaches a minimum.
	 *
	 * @private
	 */

	private _optimize(objective: Row): void {
		let iterations = 0
		while (iterations < this.maxIterations) {
			let entering = this._getEnteringSymbol(objective)
			if (entering.type() === SymbolType.Invalid) {
				return
			}
			let leaving = this._getLeavingSymbol(entering)
			if (leaving.type() === SymbolType.Invalid) {
				throw new Error('the objective is unbounded')
			}
			// pivot the entering symbol into the basis
			let row = this._rowMap.erase(leaving).second
			row.solveForEx(leaving, entering)
			this._substitute(entering, row)
			this._rowMap.insert(entering, row)

			iterations++
		}
		throw new Error('solver iterations exceeded')
	}

	/**
	 * Optimize the system using the dual of the simplex method.
	 *
	 * The current state of the system should be such that the objective
	 * function is optimal, but not feasible. This method will perform
	 * an iteration of the dual simplex method to make the solution both
	 * optimal and feasible.
	 *
	 * @private
	 */
	private _dualOptimize(): void {
		let rows = this._rowMap
		let infeasible = this._infeasibleRows
		while (infeasible.length !== 0) {
			let leaving = infeasible.pop()
			let pair = rows.find(leaving)
			if (pair !== undefined && pair.second.constant() < 0.0) {
				let entering = this._getDualEnteringSymbol(pair.second)
				if (entering.type() === SymbolType.Invalid) {
					throw new Error('dual optimize failed')
				}
				// pivot the entering symbol into the basis
				let row = pair.second
				rows.erase(leaving)
				row.solveForEx(leaving, entering)
				this._substitute(entering, row)
				rows.insert(entering, row)
			}
		}
	}

	/**
	 * Compute the entering variable for a pivot operation.
	 *
	 * This method will return first symbol in the objective function which
	 * is non-dummy and has a coefficient less than zero. If no symbol meets
	 * the criteria, it means the objective function is at a minimum, and an
	 * invalid symbol is returned.
	 *
	 * @private
	 */
	private _getEnteringSymbol(objective: Row): Symbol {
		let cells = objective.cells()
		for (let i = 0, n = cells.size(); i < n; ++i) {
			let pair = cells.itemAt(i)
			let symbol = pair.first
			if (pair.second < 0.0 && symbol.type() !== SymbolType.Dummy) {
				return symbol
			}
		}
		return INVALID_SYMBOL
	}

	/**
	 * Compute the entering symbol for the dual optimize operation.
	 *
	 * This method will return the symbol in the row which has a positive
	 * coefficient and yields the minimum ratio for its respective symbol
	 * in the objective function. The provided row *must* be infeasible.
	 * If no symbol is found which meats the criteria, an invalid symbol
	 * is returned.
	 *
	 * @private
	 */
	private _getDualEnteringSymbol(row: Row): Symbol {
		let ratio = Number.MAX_VALUE
		let entering = INVALID_SYMBOL
		let cells = row.cells()
		for (let i = 0, n = cells.size(); i < n; ++i) {
			let pair = cells.itemAt(i)
			let symbol = pair.first
			let c = pair.second
			if (c > 0.0 && symbol.type() !== SymbolType.Dummy) {
				let coeff = this._objective.coefficientFor(symbol)
				let r = coeff / c
				if (r < ratio) {
					ratio = r
					entering = symbol
				}
			}
		}
		return entering
	}

	/**
	 * Compute the symbol for pivot exit row.
	 *
	 * This method will return the symbol for the exit row in the row
	 * map. If no appropriate exit symbol is found, an invalid symbol
	 * will be returned. This indicates that the objective function is
	 * unbounded.
	 *
	 * @private
	 */
	private _getLeavingSymbol(entering: Symbol): Symbol {
		let ratio = Number.MAX_VALUE
		let found = INVALID_SYMBOL
		let rows = this._rowMap
		for (let i = 0, n = rows.size(); i < n; ++i) {
			let pair = rows.itemAt(i)
			let symbol = pair.first
			if (symbol.type() !== SymbolType.External) {
				let row = pair.second
				let temp = row.coefficientFor(entering)
				if (temp < 0.0) {
					let temp_ratio = -row.constant() / temp
					if (temp_ratio < ratio) {
						ratio = temp_ratio
						found = symbol
					}
				}
			}
		}
		return found
	}

	/**
	 * Compute the leaving symbol for a marker variable.
	 *
	 * This method will return a symbol corresponding to a basic row
	 * which holds the given marker variable. The row will be chosen
	 * according to the following precedence:
	 *
	 * 1) The row with a restricted basic varible and a negative coefficient
	 *    for the marker with the smallest ratio of -constant / coefficient.
	 *
	 * 2) The row with a restricted basic variable and the smallest ratio
	 *    of constant / coefficient.
	 *
	 * 3) The last unrestricted row which contains the marker.
	 *
	 * If the marker does not exist in any row, an invalid symbol will be
	 * returned. This indicates an internal solver error since the marker
	 * *should* exist somewhere in the tableau.
	 *
	 * @private
	 */
	private _getMarkerLeavingSymbol(marker: Symbol): Symbol {
		let dmax = Number.MAX_VALUE
		let r1 = dmax
		let r2 = dmax
		let invalid = INVALID_SYMBOL
		let first = invalid
		let second = invalid
		let third = invalid
		let rows = this._rowMap
		for (let i = 0, n = rows.size(); i < n; ++i) {
			let pair = rows.itemAt(i)
			let row = pair.second
			let c = row.coefficientFor(marker)
			if (c === 0.0) {
				continue
			}
			let symbol = pair.first
			if (symbol.type() === SymbolType.External) {
				third = symbol
			} else if (c < 0.0) {
				let r = -row.constant() / c
				if (r < r1) {
					r1 = r
					first = symbol
				}
			} else {
				let r = row.constant() / c
				if (r < r2) {
					r2 = r
					second = symbol
				}
			}
		}
		if (first !== invalid) {
			return first
		}
		if (second !== invalid) {
			return second
		}
		return third
	}

	/**
	 * Remove the effects of a constraint on the objective function.
	 *
	 * @private
	 */
	private _removeConstraintEffects(cn: Constraint, tag: ITag): void {
		if (tag.marker.type() === SymbolType.Error) {
			this._removeMarkerEffects(tag.marker, cn.strength())
		}
		if (tag.other.type() === SymbolType.Error) {
			this._removeMarkerEffects(tag.other, cn.strength())
		}
	}

	/**
	 * Remove the effects of an error marker on the objective function.
	 *
	 * @private
	 */
	private _removeMarkerEffects(marker: Symbol, strength: number): void {
		let pair = this._rowMap.find(marker)
		if (pair !== undefined) {
			this._objective.insertRow(pair.second, -strength)
		} else {
			this._objective.insertSymbol(marker, -strength)
		}
	}

	/**
	 * Get the first Slack or Error symbol in the row.
	 *
	 * If no such symbol is present, an invalid symbol will be returned.
	 *
	 * @private
	 */
	private _anyPivotableSymbol(row: Row): Symbol {
		let cells = row.cells()
		for (let i = 0, n = cells.size(); i < n; ++i) {
			let pair = cells.itemAt(i)
			let type = pair.first.type()
			if (type === SymbolType.Slack || type === SymbolType.Error) {
				return pair.first
			}
		}
		return INVALID_SYMBOL
	}

	/**
	 * Returns a new Symbol of the given type.
	 *
	 * @private
	 */
	private _makeSymbol(type: SymbolType): Symbol {
		return new Symbol(type, this._idTick++)
	}

	private _cnMap = createCnMap()
	private _rowMap = createRowMap()
	private _varMap = createVarMap()
	private _editMap = createEditMap()
	private _infeasibleRows: Symbol[] = []
	private _objective: Row = new Row()
	private _artificial: Row = null
	private _idTick: number = 0
}

/**
 * Test whether a value is approximately zero.
 * @private
 */
function nearZero(value: number): boolean {
	let eps = 1.0e-8
	return value < 0.0 ? -value < eps : value < eps
}

/**
 * The internal interface of a tag value.
 */
interface ITag {
	marker: Symbol
	other: Symbol
}

/**
 * The internal interface of an edit info object.
 */
interface IEditInfo {
	tag: ITag
	constraint: Constraint
	constant: number
}

/**
 * The internal interface for returning created row data.
 */
interface IRowCreation {
	row: Row
	tag: ITag
}

/**
 * An internal function for creating a constraint map.
 * @private
 */
function createCnMap(): IMap<Constraint, ITag> {
	return createMap<Constraint, ITag>()
}

/**
 * An internal function for creating a row map.
 * @private
 */
function createRowMap(): IMap<Symbol, Row> {
	return createMap<Symbol, Row>()
}

/**
 * An internal function for creating a variable map.
 * @private
 */
function createVarMap(): IMap<Variable, Symbol> {
	return createMap<Variable, Symbol>()
}

/**
 * An internal function for creating an edit map.
 * @private
 */
function createEditMap(): IMap<Variable, IEditInfo> {
	return createMap<Variable, IEditInfo>()
}

/**
 * An enum defining the available symbol types.
 * @private
 */
enum SymbolType {
	Invalid,
	External,
	Slack,
	Error,
	Dummy,
}

/**
 * An internal class representing a symbol in the solver.
 * @private
 */
class Symbol {
	/**
	 * Construct a new Symbol
	 *
	 * @param [type] The type of the symbol.
	 * @param [id] The unique id number of the symbol.
	 */
	constructor(type: SymbolType, id: number) {
		this._id = id
		this._type = type
	}

	/**
	 * Returns the unique id number of the symbol.
	 */
	public id(): number {
		return this._id
	}

	/**
	 * Returns the type of the symbol.
	 */
	public type(): SymbolType {
		return this._type
	}

	private _id: number
	private _type: SymbolType
}

/**
 * A static invalid symbol
 * @private
 */
let INVALID_SYMBOL = new Symbol(SymbolType.Invalid, -1)

/**
 * An internal row class used by the solver.
 * @private
 */
class Row {
	/**
	 * Construct a new Row.
	 */
	constructor(constant: number = 0.0) {
		this._constant = constant
	}

	/**
	 * Returns the mapping of symbols to coefficients.
	 */
	public cells(): IMap<Symbol, number> {
		return this._cellMap
	}

	/**
	 * Returns the constant for the row.
	 */
	public constant(): number {
		return this._constant
	}

	/**
	 * Returns true if the row is a constant value.
	 */
	public isConstant(): boolean {
		return this._cellMap.empty()
	}

	/**
	 * Returns true if the Row has all dummy symbols.
	 */
	public allDummies(): boolean {
		let cells = this._cellMap
		for (let i = 0, n = cells.size(); i < n; ++i) {
			let pair = cells.itemAt(i)
			if (pair.first.type() !== SymbolType.Dummy) {
				return false
			}
		}
		return true
	}

	/**
	 * Create a copy of the row.
	 */
	public copy(): Row {
		let theCopy = new Row(this._constant)
		theCopy._cellMap = this._cellMap.copy()
		return theCopy
	}

	/**
	 * Add a constant value to the row constant.
	 *
	 * Returns the new value of the constant.
	 */
	public add(value: number): number {
		return (this._constant += value)
	}

	/**
	 * Insert the symbol into the row with the given coefficient.
	 *
	 * If the symbol already exists in the row, the coefficient
	 * will be added to the existing coefficient. If the resulting
	 * coefficient is zero, the symbol will be removed from the row.
	 */
	public insertSymbol(symbol: Symbol, coefficient: number = 1.0): void {
		let pair = this._cellMap.setDefault(symbol, () => 0.0)
		if (nearZero((pair.second += coefficient))) {
			this._cellMap.erase(symbol)
		}
	}

	/**
	 * Insert a row into this row with a given coefficient.
	 *
	 * The constant and the cells of the other row will be
	 * multiplied by the coefficient and added to this row. Any
	 * cell with a resulting coefficient of zero will be removed
	 * from the row.
	 */
	public insertRow(other: Row, coefficient: number = 1.0): void {
		this._constant += other._constant * coefficient
		let cells = other._cellMap
		for (let i = 0, n = cells.size(); i < n; ++i) {
			let pair = cells.itemAt(i)
			this.insertSymbol(pair.first, pair.second * coefficient)
		}
	}

	/**
	 * Remove a symbol from the row.
	 */
	public removeSymbol(symbol: Symbol): void {
		this._cellMap.erase(symbol)
	}

	/**
	 * Reverse the sign of the constant and cells in the row.
	 */
	public reverseSign(): void {
		this._constant = -this._constant
		let cells = this._cellMap
		for (let i = 0, n = cells.size(); i < n; ++i) {
			let pair = cells.itemAt(i)
			pair.second = -pair.second
		}
	}

	/**
	 * Solve the row for the given symbol.
	 *
	 * This method assumes the row is of the form
	 * a * x + b * y + c = 0 and (assuming solve for x) will modify
	 * the row to represent the right hand side of
	 * x = -b/a * y - c / a. The target symbol will be removed from
	 * the row, and the constant and other cells will be multiplied
	 * by the negative inverse of the target coefficient.
	 *
	 * The given symbol *must* exist in the row.
	 */
	public solveFor(symbol: Symbol): void {
		let cells = this._cellMap
		let pair = cells.erase(symbol)
		let coeff = -1.0 / pair.second
		this._constant *= coeff
		for (let i = 0, n = cells.size(); i < n; ++i) {
			cells.itemAt(i).second *= coeff
		}
	}

	/**
	 * Solve the row for the given symbols.
	 *
	 * This method assumes the row is of the form
	 * x = b * y + c and will solve the row such that
	 * y = x / b - c / b. The rhs symbol will be removed from the
	 * row, the lhs added, and the result divided by the negative
	 * inverse of the rhs coefficient.
	 *
	 * The lhs symbol *must not* exist in the row, and the rhs
	 * symbol must* exist in the row.
	 */
	public solveForEx(lhs: Symbol, rhs: Symbol): void {
		this.insertSymbol(lhs, -1.0)
		this.solveFor(rhs)
	}

	/**
	 * Returns the coefficient for the given symbol.
	 */
	public coefficientFor(symbol: Symbol): number {
		let pair = this._cellMap.find(symbol)
		return pair !== undefined ? pair.second : 0.0
	}

	/**
	 * Substitute a symbol with the data from another row.
	 *
	 * Given a row of the form a * x + b and a substitution of the
	 * form x = 3 * y + c the row will be updated to reflect the
	 * expression 3 * a * y + a * c + b.
	 *
	 * If the symbol does not exist in the row, this is a no-op.
	 */
	public substitute(symbol: Symbol, row: Row): void {
		let pair = this._cellMap.erase(symbol)
		if (pair !== undefined) {
			this.insertRow(row, pair.second)
		}
	}

	private _cellMap = createMap<Symbol, number>()
	private _constant: number
}
