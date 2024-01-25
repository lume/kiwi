import {Expression} from './expression.js'

/**
 * The primary user constraint variable.
 *
 * @class
 * @param {String} [name=""] The name to associated with the variable.
 */
export class Variable {
	constructor(name: string = '') {
		this._name = name
	}

	/**
	 * Returns the unique id number of the variable.
	 * @private
	 */
	public id(): number {
		return this._id
	}

	/**
	 * Returns the name of the variable.
	 *
	 * @return {String} name of the variable
	 */
	public name(): string {
		return this._name
	}

	/**
	 * Set the name of the variable.
	 *
	 * @param {String} name Name of the variable
	 */
	public setName(name: string): void {
		this._name = name
	}

	/**
	 * Returns the user context object of the variable.
	 * @private
	 */
	public context(): any {
		return this._context
	}

	/**
	 * Set the user context object of the variable.
	 * @private
	 */
	public setContext(context: any): void {
		this._context = context
	}

	/**
	 * Returns the value of the variable.
	 *
	 * @return {Number} Calculated value
	 */
	public value(): number {
		return this._value
	}

	/**
	 * Set the value of the variable.
	 * @private
	 */
	public setValue(value: number): void {
		var previousValue = this._value
		this._value = value
		if (this._callback && previousValue !== value) {
			this._callback(value, previousValue)
		}
	}

	/**
	 * Set a callback for whenever the value changes.
	 *
	 * @param {function(number,number):void} callback to call whenever the variable value changes
	 */
	public subscribe(callback: (value: number, previousValue: number) => void): void {
		this._callback = callback
	}

	/**
	 * Stops the variable from calling the callback when the variable value
	 * changes.
	 */
	public unsubscribe(): void {
		this._callback = null
	}

	/**
	 * Creates a new Expression by adding a number, variable or expression
	 * to the variable.
	 *
	 * @param {Number|Variable|Expression} value Value to add.
	 * @return {Expression} expression
	 */
	public plus(value: number | Variable | Expression): Expression {
		return new Expression(this, value)
	}

	/**
	 * Creates a new Expression by substracting a number, variable or expression
	 * from the variable.
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

	/**
	 * Returns the JSON representation of the variable.
	 * @private
	 */
	public toJSON(): any {
		return {
			name: this._name,
			value: this._value,
		}
	}

	public toString(): string {
		return this._context + '[' + this._name + ':' + this._value + ']'
	}

	private _name: string
	private _value: number = 0.0
	private _context: any = null
	private _id: number = VarId++
	private _callback: (value: number, previousValue: number) => void
}

/**
 * The internal variable id counter.
 * @private
 */
let VarId = 0
