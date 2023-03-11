import {createMap, IMap} from './maptype.js'
import {Variable} from './variable.js'

/**
 * An expression of variable terms and a constant.
 *
 * The constructor accepts an arbitrary number of parameters,
 * each of which must be one of the following types:
 *  - number
 *  - Variable
 *  - Expression
 *  - 2-tuple of [number, Variable|Expression]
 *
 * The parameters are summed. The tuples are multiplied.
 *
 * @class
 * @param {...(number|Variable|Expression|Array)} args
 */
export class Expression {
	constructor(...args: any[])
	constructor() {
		let parsed = parseArgs(arguments)
		this._terms = parsed.terms
		this._constant = parsed.constant
	}

	/**
	 * Returns the mapping of terms in the expression.
	 *
	 * This *must* be treated as const.
	 * @private
	 */
	public terms(): IMap<Variable, number> {
		return this._terms
	}

	/**
	 * Returns the constant of the expression.
	 * @private
	 */
	public constant(): number {
		return this._constant
	}

	/**
	 * Returns the computed value of the expression.
	 *
	 * @private
	 * @return {Number} computed value of the expression
	 */
	public value(): number {
		let result = this._constant
		for (let i = 0, n = this._terms.size(); i < n; i++) {
			let pair = this._terms.itemAt(i)
			result += pair.first.value() * pair.second
		}
		return result
	}

	/**
	 * Creates a new Expression by adding a number, variable or expression
	 * to the expression.
	 *
	 * @param {Number|Variable|Expression} value Value to add.
	 * @return {Expression} expression
	 */
	public plus(value: number | Variable | Expression): Expression {
		return new Expression(this, value)
	}

	/**
	 * Creates a new Expression by substracting a number, variable or expression
	 * from the expression.
	 *
	 * @param {Number|Variable|Expression} value Value to substract.
	 * @return {Expression} expression
	 */
	public minus(value: number | Variable | Expression): Expression {
		return new Expression(this, typeof value === 'number' ? -value : [-1, value])
	}

	/**
	 * Creates a new Expression by multiplying with a fixed number.
	 *
	 * @param {Number} coefficient Coefficient to multiply with.
	 * @return {Expression} expression
	 */
	public multiply(coefficient: number): Expression {
		return new Expression([coefficient, this])
	}

	/**
	 * Creates a new Expression by dividing with a fixed number.
	 *
	 * @param {Number} coefficient Coefficient to divide by.
	 * @return {Expression} expression
	 */
	public divide(coefficient: number): Expression {
		return new Expression([1 / coefficient, this])
	}

	public isConstant(): boolean {
		return this._terms.size() == 0
	}

	public toString(): string {
		let result = this._terms.array
			.map(function (pair) {
				return pair.second + '*' + pair.first.toString()
			})
			.join(' + ')

		if (!this.isConstant() && this._constant !== 0) {
			result += ' + '
		}

		result += this._constant

		return result
	}

	private _terms: IMap<Variable, number>
	private _constant: number
}

/**
 * An internal interface for the argument parse results.
 */
interface IParseResult {
	terms: IMap<Variable, number>
	constant: number
}

/**
 * An internal argument parsing function.
 * @private
 */
function parseArgs(args: IArguments): IParseResult {
	let constant = 0.0
	let factory = () => 0.0
	let terms = createMap<Variable, number>()
	for (let i = 0, n = args.length; i < n; ++i) {
		let item = args[i]
		if (typeof item === 'number') {
			constant += item
		} else if (item instanceof Variable) {
			terms.setDefault(item, factory).second += 1.0
		} else if (item instanceof Expression) {
			constant += item.constant()
			let terms2 = item.terms()
			for (let j = 0, k = terms2.size(); j < k; j++) {
				let termPair = terms2.itemAt(j)
				terms.setDefault(termPair.first, factory).second += termPair.second
			}
		} else if (item instanceof Array) {
			if (item.length !== 2) {
				throw new Error('array must have length 2')
			}
			let value: number = item[0]
			let value2 = item[1]
			if (typeof value !== 'number') {
				throw new Error('array item 0 must be a number')
			}
			if (value2 instanceof Variable) {
				terms.setDefault(value2, factory).second += value
			} else if (value2 instanceof Expression) {
				constant += value2.constant() * value
				let terms2 = value2.terms()
				for (let j = 0, k = terms2.size(); j < k; j++) {
					let termPair = terms2.itemAt(j)
					terms.setDefault(termPair.first, factory).second += termPair.second * value
				}
			} else {
				throw new Error('array item 1 must be a variable or expression')
			}
		} else {
			throw new Error('invalid Expression argument: ' + item)
		}
	}
	return {terms, constant}
}
