import { Expression } from './expression.js';
/**
 * The primary user constraint variable.
 *
 * @class
 * @param {String} [name=""] The name to associated with the variable.
 */
export class Variable {
    constructor(name = '') {
        this._name = name;
    }
    /**
     * Returns the unique id number of the variable.
     * @private
     */
    id() {
        return this._id;
    }
    /**
     * Returns the name of the variable.
     *
     * @return {String} name of the variable
     */
    name() {
        return this._name;
    }
    /**
     * Set the name of the variable.
     *
     * @param {String} name Name of the variable
     */
    setName(name) {
        this._name = name;
    }
    /**
     * Returns the user context object of the variable.
     * @private
     */
    context() {
        return this._context;
    }
    /**
     * Set the user context object of the variable.
     * @private
     */
    setContext(context) {
        this._context = context;
    }
    /**
     * Returns the value of the variable.
     *
     * @return {Number} Calculated value
     */
    value() {
        return this._value;
    }
    /**
     * Set the value of the variable.
     * @private
     */
    setValue(value) {
        this._value = value;
    }
    /**
     * Creates a new Expression by adding a number, variable or expression
     * to the variable.
     *
     * @param {Number|Variable|Expression} value Value to add.
     * @return {Expression} expression
     */
    plus(value) {
        return new Expression(this, value);
    }
    /**
     * Creates a new Expression by substracting a number, variable or expression
     * from the variable.
     *
     * @param {Number|Variable|Expression} value Value to substract.
     * @return {Expression} expression
     */
    minus(value) {
        return new Expression(this, typeof value === 'number' ? -value : [-1, value]);
    }
    /**
     * Creates a new Expression by multiplying with a fixed number.
     *
     * @param {Number} coefficient Coefficient to multiply with.
     * @return {Expression} expression
     */
    multiply(coefficient) {
        return new Expression([coefficient, this]);
    }
    /**
     * Creates a new Expression by dividing with a fixed number.
     *
     * @param {Number} coefficient Coefficient to divide by.
     * @return {Expression} expression
     */
    divide(coefficient) {
        return new Expression([1 / coefficient, this]);
    }
    /**
     * Returns the JSON representation of the variable.
     * @private
     */
    toJSON() {
        return {
            name: this._name,
            value: this._value,
        };
    }
    toString() {
        return this._context + '[' + this._name + ':' + this._value + ']';
    }
    _name;
    _value = 0.0;
    _context = null;
    _id = VarId++;
}
/**
 * The internal variable id counter.
 * @private
 */
let VarId = 0;
