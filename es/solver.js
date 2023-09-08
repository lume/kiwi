import { Constraint, Operator } from './constraint.js';
import { Expression } from './expression.js';
import { createMap } from './maptype.js';
import { Strength } from './strength.js';
/**
 * The constraint solver class.
 *
 * @class
 */
var Solver = /** @class */ (function () {
    /**
     * Construct a new Solver.
     */
    function Solver() {
        /**
         * @type {number} - The max number of solver iterations before an error
         * is thrown, in order to prevent infinite iteration. Default: `10,000`.
         */
        this.maxIterations = 1000;
        this._cnMap = createCnMap();
        this._rowMap = createRowMap();
        this._varMap = createVarMap();
        this._editMap = createEditMap();
        this._infeasibleRows = [];
        this._objective = new Row();
        this._artificial = null;
        this._idTick = 0;
    }
    /**
     * Creates and add a constraint to the solver.
     *
     * @param {Expression|Variable} lhs Left hand side of the expression
     * @param {Operator} operator Operator
     * @param {Expression|Variable|Number} rhs Right hand side of the expression
     * @param {Number} [strength=Strength.required] Strength
     */
    Solver.prototype.createConstraint = function (lhs, operator, rhs, strength) {
        if (strength === void 0) { strength = Strength.required; }
        var cn = new Constraint(lhs, operator, rhs, strength);
        this.addConstraint(cn);
        return cn;
    };
    /**
     * Add a constraint to the solver.
     *
     * @param {Constraint} constraint Constraint to add to the solver
     */
    Solver.prototype.addConstraint = function (constraint) {
        var cnPair = this._cnMap.find(constraint);
        if (cnPair !== undefined) {
            throw new Error('duplicate constraint');
        }
        // Creating a row causes symbols to be reserved for the variables
        // in the constraint. If this method exits with an exception,
        // then its possible those variables will linger in the var map.
        // Since its likely that those variables will be used in other
        // constraints and since exceptional conditions are uncommon,
        // i'm not too worried about aggressive cleanup of the var map.
        var data = this._createRow(constraint);
        var row = data.row;
        var tag = data.tag;
        var subject = this._chooseSubject(row, tag);
        // If chooseSubject couldnt find a valid entering symbol, one
        // last option is available if the entire row is composed of
        // dummy variables. If the constant of the row is zero, then
        // this represents redundant constraints and the new dummy
        // marker can enter the basis. If the constant is non-zero,
        // then it represents an unsatisfiable constraint.
        if (subject.type() === SymbolType.Invalid && row.allDummies()) {
            if (!nearZero(row.constant())) {
                throw new Error('unsatisfiable constraint');
            }
            else {
                subject = tag.marker;
            }
        }
        // If an entering symbol still isn't found, then the row must
        // be added using an artificial variable. If that fails, then
        // the row represents an unsatisfiable constraint.
        if (subject.type() === SymbolType.Invalid) {
            if (!this._addWithArtificialVariable(row)) {
                throw new Error('unsatisfiable constraint');
            }
        }
        else {
            row.solveFor(subject);
            this._substitute(subject, row);
            this._rowMap.insert(subject, row);
        }
        this._cnMap.insert(constraint, tag);
        // Optimizing after each constraint is added performs less
        // aggregate work due to a smaller average system size. It
        // also ensures the solver remains in a consistent state.
        this._optimize(this._objective);
    };
    /**
     * Remove a constraint from the solver.
     *
     * @param {Constraint} constraint Constraint to remove from the solver
     */
    Solver.prototype.removeConstraint = function (constraint) {
        var cnPair = this._cnMap.erase(constraint);
        if (cnPair === undefined) {
            throw new Error('unknown constraint');
        }
        // Remove the error effects from the objective function
        // *before* pivoting, or substitutions into the objective
        // will lead to incorrect solver results.
        this._removeConstraintEffects(constraint, cnPair.second);
        // If the marker is basic, simply drop the row. Otherwise,
        // pivot the marker into the basis and then drop the row.
        var marker = cnPair.second.marker;
        var rowPair = this._rowMap.erase(marker);
        if (rowPair === undefined) {
            var leaving = this._getMarkerLeavingSymbol(marker);
            if (leaving.type() === SymbolType.Invalid) {
                throw new Error('failed to find leaving row');
            }
            rowPair = this._rowMap.erase(leaving);
            rowPair.second.solveForEx(leaving, marker);
            this._substitute(marker, rowPair.second);
        }
        // Optimizing after each constraint is removed ensures that the
        // solver remains consistent. It makes the solver api easier to
        // use at a small tradeoff for speed.
        this._optimize(this._objective);
    };
    /**
     * Test whether the solver contains the constraint.
     *
     * @param {Constraint} constraint Constraint to test for
     * @return {Bool} true or false
     */
    Solver.prototype.hasConstraint = function (constraint) {
        return this._cnMap.contains(constraint);
    };
    /**
     * Add an edit variable to the solver.
     *
     * @param {Variable} variable Edit variable to add to the solver
     * @param {Number} strength Strength, should be less than `Strength.required`
     */
    Solver.prototype.addEditVariable = function (variable, strength) {
        var editPair = this._editMap.find(variable);
        if (editPair !== undefined) {
            throw new Error('duplicate edit variable');
        }
        strength = Strength.clip(strength);
        if (strength === Strength.required) {
            throw new Error('bad required strength');
        }
        var expr = new Expression(variable);
        var cn = new Constraint(expr, Operator.Eq, undefined, strength);
        this.addConstraint(cn);
        var tag = this._cnMap.find(cn).second;
        var info = { tag: tag, constraint: cn, constant: 0.0 };
        this._editMap.insert(variable, info);
    };
    /**
     * Remove an edit variable from the solver.
     *
     * @param {Variable} variable Edit variable to remove from the solver
     */
    Solver.prototype.removeEditVariable = function (variable) {
        var editPair = this._editMap.erase(variable);
        if (editPair === undefined) {
            throw new Error('unknown edit variable');
        }
        this.removeConstraint(editPair.second.constraint);
    };
    /**
     * Test whether the solver contains the edit variable.
     *
     * @param {Variable} variable Edit variable to test for
     * @return {Bool} true or false
     */
    Solver.prototype.hasEditVariable = function (variable) {
        return this._editMap.contains(variable);
    };
    /**
     * Suggest the value of an edit variable.
     *
     * @param {Variable} variable Edit variable to suggest a value for
     * @param {Number} value Suggested value
     */
    Solver.prototype.suggestValue = function (variable, value) {
        var editPair = this._editMap.find(variable);
        if (editPair === undefined) {
            throw new Error('unknown edit variable');
        }
        var rows = this._rowMap;
        var info = editPair.second;
        var delta = value - info.constant;
        info.constant = value;
        // Check first if the positive error variable is basic.
        var marker = info.tag.marker;
        var rowPair = rows.find(marker);
        if (rowPair !== undefined) {
            if (rowPair.second.add(-delta) < 0.0) {
                this._infeasibleRows.push(marker);
            }
            this._dualOptimize();
            return;
        }
        // Check next if the negative error variable is basic.
        var other = info.tag.other;
        rowPair = rows.find(other);
        if (rowPair !== undefined) {
            if (rowPair.second.add(delta) < 0.0) {
                this._infeasibleRows.push(other);
            }
            this._dualOptimize();
            return;
        }
        // Otherwise update each row where the error variables exist.
        for (var i = 0, n = rows.size(); i < n; ++i) {
            var rowPair_1 = rows.itemAt(i);
            var row = rowPair_1.second;
            var coeff = row.coefficientFor(marker);
            if (coeff !== 0.0 && row.add(delta * coeff) < 0.0 && rowPair_1.first.type() !== SymbolType.External) {
                this._infeasibleRows.push(rowPair_1.first);
            }
        }
        this._dualOptimize();
    };
    /**
     * Update the values of the variables.
     */
    Solver.prototype.updateVariables = function () {
        var vars = this._varMap;
        var rows = this._rowMap;
        for (var i = 0, n = vars.size(); i < n; ++i) {
            var pair = vars.itemAt(i);
            var rowPair = rows.find(pair.second);
            if (rowPair !== undefined) {
                pair.first.setValue(rowPair.second.constant());
            }
            else {
                pair.first.setValue(0.0);
            }
        }
    };
    /**
     * Get the symbol for the given variable.
     *
     * If a symbol does not exist for the variable, one will be created.
     * @private
     */
    Solver.prototype._getVarSymbol = function (variable) {
        var _this = this;
        var factory = function () { return _this._makeSymbol(SymbolType.External); };
        return this._varMap.setDefault(variable, factory).second;
    };
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
    Solver.prototype._createRow = function (constraint) {
        var expr = constraint.expression();
        var row = new Row(expr.constant());
        // Substitute the current basic variables into the row.
        var terms = expr.terms();
        for (var i = 0, n = terms.size(); i < n; ++i) {
            var termPair = terms.itemAt(i);
            if (!nearZero(termPair.second)) {
                var symbol = this._getVarSymbol(termPair.first);
                var basicPair = this._rowMap.find(symbol);
                if (basicPair !== undefined) {
                    row.insertRow(basicPair.second, termPair.second);
                }
                else {
                    row.insertSymbol(symbol, termPair.second);
                }
            }
        }
        // Add the necessary slack, error, and dummy variables.
        var objective = this._objective;
        var strength = constraint.strength();
        var tag = { marker: INVALID_SYMBOL, other: INVALID_SYMBOL };
        switch (constraint.op()) {
            case Operator.Le:
            case Operator.Ge: {
                var coeff = constraint.op() === Operator.Le ? 1.0 : -1.0;
                var slack = this._makeSymbol(SymbolType.Slack);
                tag.marker = slack;
                row.insertSymbol(slack, coeff);
                if (strength < Strength.required) {
                    var error = this._makeSymbol(SymbolType.Error);
                    tag.other = error;
                    row.insertSymbol(error, -coeff);
                    objective.insertSymbol(error, strength);
                }
                break;
            }
            case Operator.Eq: {
                if (strength < Strength.required) {
                    var errplus = this._makeSymbol(SymbolType.Error);
                    var errminus = this._makeSymbol(SymbolType.Error);
                    tag.marker = errplus;
                    tag.other = errminus;
                    row.insertSymbol(errplus, -1.0); // v = eplus - eminus
                    row.insertSymbol(errminus, 1.0); // v - eplus + eminus = 0
                    objective.insertSymbol(errplus, strength);
                    objective.insertSymbol(errminus, strength);
                }
                else {
                    var dummy = this._makeSymbol(SymbolType.Dummy);
                    tag.marker = dummy;
                    row.insertSymbol(dummy);
                }
                break;
            }
        }
        // Ensure the row has a positive constant.
        if (row.constant() < 0.0) {
            row.reverseSign();
        }
        return { row: row, tag: tag };
    };
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
    Solver.prototype._chooseSubject = function (row, tag) {
        var cells = row.cells();
        for (var i = 0, n = cells.size(); i < n; ++i) {
            var pair = cells.itemAt(i);
            if (pair.first.type() === SymbolType.External) {
                return pair.first;
            }
        }
        var type = tag.marker.type();
        if (type === SymbolType.Slack || type === SymbolType.Error) {
            if (row.coefficientFor(tag.marker) < 0.0) {
                return tag.marker;
            }
        }
        type = tag.other.type();
        if (type === SymbolType.Slack || type === SymbolType.Error) {
            if (row.coefficientFor(tag.other) < 0.0) {
                return tag.other;
            }
        }
        return INVALID_SYMBOL;
    };
    /**
     * Add the row to the tableau using an artificial variable.
     *
     * This will return false if the constraint cannot be satisfied.
     *
     * @private
     */
    Solver.prototype._addWithArtificialVariable = function (row) {
        // Create and add the artificial variable to the tableau.
        var art = this._makeSymbol(SymbolType.Slack);
        this._rowMap.insert(art, row.copy());
        this._artificial = row.copy();
        // Optimize the artificial objective. This is successful
        // only if the artificial objective is optimized to zero.
        this._optimize(this._artificial);
        var success = nearZero(this._artificial.constant());
        this._artificial = null;
        // If the artificial variable is basic, pivot the row so that
        // it becomes non-basic. If the row is constant, exit early.
        var pair = this._rowMap.erase(art);
        if (pair !== undefined) {
            var basicRow = pair.second;
            if (basicRow.isConstant()) {
                return success;
            }
            var entering = this._anyPivotableSymbol(basicRow);
            if (entering.type() === SymbolType.Invalid) {
                return false; // unsatisfiable (will this ever happen?)
            }
            basicRow.solveForEx(art, entering);
            this._substitute(entering, basicRow);
            this._rowMap.insert(entering, basicRow);
        }
        // Remove the artificial variable from the tableau.
        var rows = this._rowMap;
        for (var i = 0, n = rows.size(); i < n; ++i) {
            rows.itemAt(i).second.removeSymbol(art);
        }
        this._objective.removeSymbol(art);
        return success;
    };
    /**
     * Substitute the parametric symbol with the given row.
     *
     * This method will substitute all instances of the parametric symbol
     * in the tableau and the objective function with the given row.
     *
     * @private
     */
    Solver.prototype._substitute = function (symbol, row) {
        var rows = this._rowMap;
        for (var i = 0, n = rows.size(); i < n; ++i) {
            var pair = rows.itemAt(i);
            pair.second.substitute(symbol, row);
            if (pair.second.constant() < 0.0 && pair.first.type() !== SymbolType.External) {
                this._infeasibleRows.push(pair.first);
            }
        }
        this._objective.substitute(symbol, row);
        if (this._artificial) {
            this._artificial.substitute(symbol, row);
        }
    };
    /**
     * Optimize the system for the given objective function.
     *
     * This method performs iterations of Phase 2 of the simplex method
     * until the objective function reaches a minimum.
     *
     * @private
     */
    Solver.prototype._optimize = function (objective) {
        var iterations = 0;
        while (iterations < this.maxIterations) {
            var entering = this._getEnteringSymbol(objective);
            if (entering.type() === SymbolType.Invalid) {
                return;
            }
            var leaving = this._getLeavingSymbol(entering);
            if (leaving.type() === SymbolType.Invalid) {
                throw new Error('the objective is unbounded');
            }
            // pivot the entering symbol into the basis
            var row = this._rowMap.erase(leaving).second;
            row.solveForEx(leaving, entering);
            this._substitute(entering, row);
            this._rowMap.insert(entering, row);
            iterations++;
        }
        throw new Error('solver iterations exceeded');
    };
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
    Solver.prototype._dualOptimize = function () {
        var rows = this._rowMap;
        var infeasible = this._infeasibleRows;
        while (infeasible.length !== 0) {
            var leaving = infeasible.pop();
            var pair = rows.find(leaving);
            if (pair !== undefined && pair.second.constant() < 0.0) {
                var entering = this._getDualEnteringSymbol(pair.second);
                if (entering.type() === SymbolType.Invalid) {
                    throw new Error('dual optimize failed');
                }
                // pivot the entering symbol into the basis
                var row = pair.second;
                rows.erase(leaving);
                row.solveForEx(leaving, entering);
                this._substitute(entering, row);
                rows.insert(entering, row);
            }
        }
    };
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
    Solver.prototype._getEnteringSymbol = function (objective) {
        var cells = objective.cells();
        for (var i = 0, n = cells.size(); i < n; ++i) {
            var pair = cells.itemAt(i);
            var symbol = pair.first;
            if (pair.second < 0.0 && symbol.type() !== SymbolType.Dummy) {
                return symbol;
            }
        }
        return INVALID_SYMBOL;
    };
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
    Solver.prototype._getDualEnteringSymbol = function (row) {
        var ratio = Number.MAX_VALUE;
        var entering = INVALID_SYMBOL;
        var cells = row.cells();
        for (var i = 0, n = cells.size(); i < n; ++i) {
            var pair = cells.itemAt(i);
            var symbol = pair.first;
            var c = pair.second;
            if (c > 0.0 && symbol.type() !== SymbolType.Dummy) {
                var coeff = this._objective.coefficientFor(symbol);
                var r = coeff / c;
                if (r < ratio) {
                    ratio = r;
                    entering = symbol;
                }
            }
        }
        return entering;
    };
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
    Solver.prototype._getLeavingSymbol = function (entering) {
        var ratio = Number.MAX_VALUE;
        var found = INVALID_SYMBOL;
        var rows = this._rowMap;
        for (var i = 0, n = rows.size(); i < n; ++i) {
            var pair = rows.itemAt(i);
            var symbol = pair.first;
            if (symbol.type() !== SymbolType.External) {
                var row = pair.second;
                var temp = row.coefficientFor(entering);
                if (temp < 0.0) {
                    var temp_ratio = -row.constant() / temp;
                    if (temp_ratio < ratio) {
                        ratio = temp_ratio;
                        found = symbol;
                    }
                }
            }
        }
        return found;
    };
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
    Solver.prototype._getMarkerLeavingSymbol = function (marker) {
        var dmax = Number.MAX_VALUE;
        var r1 = dmax;
        var r2 = dmax;
        var invalid = INVALID_SYMBOL;
        var first = invalid;
        var second = invalid;
        var third = invalid;
        var rows = this._rowMap;
        for (var i = 0, n = rows.size(); i < n; ++i) {
            var pair = rows.itemAt(i);
            var row = pair.second;
            var c = row.coefficientFor(marker);
            if (c === 0.0) {
                continue;
            }
            var symbol = pair.first;
            if (symbol.type() === SymbolType.External) {
                third = symbol;
            }
            else if (c < 0.0) {
                var r = -row.constant() / c;
                if (r < r1) {
                    r1 = r;
                    first = symbol;
                }
            }
            else {
                var r = row.constant() / c;
                if (r < r2) {
                    r2 = r;
                    second = symbol;
                }
            }
        }
        if (first !== invalid) {
            return first;
        }
        if (second !== invalid) {
            return second;
        }
        return third;
    };
    /**
     * Remove the effects of a constraint on the objective function.
     *
     * @private
     */
    Solver.prototype._removeConstraintEffects = function (cn, tag) {
        if (tag.marker.type() === SymbolType.Error) {
            this._removeMarkerEffects(tag.marker, cn.strength());
        }
        if (tag.other.type() === SymbolType.Error) {
            this._removeMarkerEffects(tag.other, cn.strength());
        }
    };
    /**
     * Remove the effects of an error marker on the objective function.
     *
     * @private
     */
    Solver.prototype._removeMarkerEffects = function (marker, strength) {
        var pair = this._rowMap.find(marker);
        if (pair !== undefined) {
            this._objective.insertRow(pair.second, -strength);
        }
        else {
            this._objective.insertSymbol(marker, -strength);
        }
    };
    /**
     * Get the first Slack or Error symbol in the row.
     *
     * If no such symbol is present, an invalid symbol will be returned.
     *
     * @private
     */
    Solver.prototype._anyPivotableSymbol = function (row) {
        var cells = row.cells();
        for (var i = 0, n = cells.size(); i < n; ++i) {
            var pair = cells.itemAt(i);
            var type = pair.first.type();
            if (type === SymbolType.Slack || type === SymbolType.Error) {
                return pair.first;
            }
        }
        return INVALID_SYMBOL;
    };
    /**
     * Returns a new Symbol of the given type.
     *
     * @private
     */
    Solver.prototype._makeSymbol = function (type) {
        return new Symbol(type, this._idTick++);
    };
    return Solver;
}());
export { Solver };
/**
 * Test whether a value is approximately zero.
 * @private
 */
function nearZero(value) {
    var eps = 1.0e-8;
    return value < 0.0 ? -value < eps : value < eps;
}
/**
 * An internal function for creating a constraint map.
 * @private
 */
function createCnMap() {
    return createMap();
}
/**
 * An internal function for creating a row map.
 * @private
 */
function createRowMap() {
    return createMap();
}
/**
 * An internal function for creating a variable map.
 * @private
 */
function createVarMap() {
    return createMap();
}
/**
 * An internal function for creating an edit map.
 * @private
 */
function createEditMap() {
    return createMap();
}
/**
 * An enum defining the available symbol types.
 * @private
 */
var SymbolType;
(function (SymbolType) {
    SymbolType[SymbolType["Invalid"] = 0] = "Invalid";
    SymbolType[SymbolType["External"] = 1] = "External";
    SymbolType[SymbolType["Slack"] = 2] = "Slack";
    SymbolType[SymbolType["Error"] = 3] = "Error";
    SymbolType[SymbolType["Dummy"] = 4] = "Dummy";
})(SymbolType || (SymbolType = {}));
/**
 * An internal class representing a symbol in the solver.
 * @private
 */
var Symbol = /** @class */ (function () {
    /**
     * Construct a new Symbol
     *
     * @param [type] The type of the symbol.
     * @param [id] The unique id number of the symbol.
     */
    function Symbol(type, id) {
        this._id = id;
        this._type = type;
    }
    /**
     * Returns the unique id number of the symbol.
     */
    Symbol.prototype.id = function () {
        return this._id;
    };
    /**
     * Returns the type of the symbol.
     */
    Symbol.prototype.type = function () {
        return this._type;
    };
    return Symbol;
}());
/**
 * A static invalid symbol
 * @private
 */
var INVALID_SYMBOL = new Symbol(SymbolType.Invalid, -1);
/**
 * An internal row class used by the solver.
 * @private
 */
var Row = /** @class */ (function () {
    /**
     * Construct a new Row.
     */
    function Row(constant) {
        if (constant === void 0) { constant = 0.0; }
        this._cellMap = createMap();
        this._constant = constant;
    }
    /**
     * Returns the mapping of symbols to coefficients.
     */
    Row.prototype.cells = function () {
        return this._cellMap;
    };
    /**
     * Returns the constant for the row.
     */
    Row.prototype.constant = function () {
        return this._constant;
    };
    /**
     * Returns true if the row is a constant value.
     */
    Row.prototype.isConstant = function () {
        return this._cellMap.empty();
    };
    /**
     * Returns true if the Row has all dummy symbols.
     */
    Row.prototype.allDummies = function () {
        var cells = this._cellMap;
        for (var i = 0, n = cells.size(); i < n; ++i) {
            var pair = cells.itemAt(i);
            if (pair.first.type() !== SymbolType.Dummy) {
                return false;
            }
        }
        return true;
    };
    /**
     * Create a copy of the row.
     */
    Row.prototype.copy = function () {
        var theCopy = new Row(this._constant);
        theCopy._cellMap = this._cellMap.copy();
        return theCopy;
    };
    /**
     * Add a constant value to the row constant.
     *
     * Returns the new value of the constant.
     */
    Row.prototype.add = function (value) {
        return (this._constant += value);
    };
    /**
     * Insert the symbol into the row with the given coefficient.
     *
     * If the symbol already exists in the row, the coefficient
     * will be added to the existing coefficient. If the resulting
     * coefficient is zero, the symbol will be removed from the row.
     */
    Row.prototype.insertSymbol = function (symbol, coefficient) {
        if (coefficient === void 0) { coefficient = 1.0; }
        var pair = this._cellMap.setDefault(symbol, function () { return 0.0; });
        if (nearZero((pair.second += coefficient))) {
            this._cellMap.erase(symbol);
        }
    };
    /**
     * Insert a row into this row with a given coefficient.
     *
     * The constant and the cells of the other row will be
     * multiplied by the coefficient and added to this row. Any
     * cell with a resulting coefficient of zero will be removed
     * from the row.
     */
    Row.prototype.insertRow = function (other, coefficient) {
        if (coefficient === void 0) { coefficient = 1.0; }
        this._constant += other._constant * coefficient;
        var cells = other._cellMap;
        for (var i = 0, n = cells.size(); i < n; ++i) {
            var pair = cells.itemAt(i);
            this.insertSymbol(pair.first, pair.second * coefficient);
        }
    };
    /**
     * Remove a symbol from the row.
     */
    Row.prototype.removeSymbol = function (symbol) {
        this._cellMap.erase(symbol);
    };
    /**
     * Reverse the sign of the constant and cells in the row.
     */
    Row.prototype.reverseSign = function () {
        this._constant = -this._constant;
        var cells = this._cellMap;
        for (var i = 0, n = cells.size(); i < n; ++i) {
            var pair = cells.itemAt(i);
            pair.second = -pair.second;
        }
    };
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
    Row.prototype.solveFor = function (symbol) {
        var cells = this._cellMap;
        var pair = cells.erase(symbol);
        var coeff = -1.0 / pair.second;
        this._constant *= coeff;
        for (var i = 0, n = cells.size(); i < n; ++i) {
            cells.itemAt(i).second *= coeff;
        }
    };
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
    Row.prototype.solveForEx = function (lhs, rhs) {
        this.insertSymbol(lhs, -1.0);
        this.solveFor(rhs);
    };
    /**
     * Returns the coefficient for the given symbol.
     */
    Row.prototype.coefficientFor = function (symbol) {
        var pair = this._cellMap.find(symbol);
        return pair !== undefined ? pair.second : 0.0;
    };
    /**
     * Substitute a symbol with the data from another row.
     *
     * Given a row of the form a * x + b and a substitution of the
     * form x = 3 * y + c the row will be updated to reflect the
     * expression 3 * a * y + a * c + b.
     *
     * If the symbol does not exist in the row, this is a no-op.
     */
    Row.prototype.substitute = function (symbol, row) {
        var pair = this._cellMap.erase(symbol);
        if (pair !== undefined) {
            this.insertRow(row, pair.second);
        }
    };
    return Row;
}());
