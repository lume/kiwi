import { Expression } from './expression.js';
import { Strength } from './strength.js';
/**
 * An enum defining the linear constraint operators.
 *
 * |Value|Operator|Description|
 * |----|-----|-----|
 * |`Le`|<=|Less than equal|
 * |`Ge`|>=|Greater than equal|
 * |`Eq`|==|Equal|
 *
 * @enum {Number}
 */
export var Operator;
(function (Operator) {
    Operator[Operator["Le"] = 0] = "Le";
    Operator[Operator["Ge"] = 1] = "Ge";
    Operator[Operator["Eq"] = 2] = "Eq";
})(Operator || (Operator = {}));
/**
 * A linear constraint equation.
 *
 * A constraint equation is composed of an expression, an operator,
 * and a strength. The RHS of the equation is implicitly zero.
 *
 * @class
 * @param {Expression} expression The constraint expression (LHS).
 * @param {Operator} operator The equation operator.
 * @param {Expression} [rhs] Right hand side of the expression.
 * @param {Number} [strength=Strength.required] The strength of the constraint.
 */
export class Constraint {
    constructor(expression, operator, rhs, strength = Strength.required) {
        this._operator = operator;
        this._strength = Strength.clip(strength);
        if (rhs === undefined && expression instanceof Expression) {
            this._expression = expression;
        }
        else {
            this._expression = expression.minus(rhs);
        }
    }
    /**
     * Returns the unique id number of the constraint.
     * @private
     */
    id() {
        return this._id;
    }
    /**
     * Returns the expression of the constraint.
     *
     * @return {Expression} expression
     */
    expression() {
        return this._expression;
    }
    /**
     * Returns the relational operator of the constraint.
     *
     * @return {Operator} linear constraint operator
     */
    op() {
        return this._operator;
    }
    /**
     * Returns the strength of the constraint.
     *
     * @return {Number} strength
     */
    strength() {
        return this._strength;
    }
    toString() {
        return (this._expression.toString() + ' ' + ['<=', '>=', '='][this._operator] + ' 0 (' + this._strength.toString() + ')');
    }
    _expression;
    _operator;
    _strength;
    _id = CnId++;
}
/**
 * The internal constraint id counter.
 * @private
 */
let CnId = 0;
