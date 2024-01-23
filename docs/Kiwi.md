<a name="module_@lume/kiwi"></a>

# @lume/kiwi

Lume Kiwi is an efficient implementation of the Cassowary constraint solving
algorithm, based on the seminal Cassowary paper.
It is _not_ a refactoring or port of the original C++ solver, but
has been designed from the ground up to be lightweight and fast.

**Example**

```javascript
import * as kiwi from '@lume/kiwi'

// Create a solver
const solver = new kiwi.Solver()

// Adjust the max number of solver iterations before an error is thrown if
// more is needed. Default is 10,000.
solver.maxIterations = 20000

// Create and add some editable variables
const left = new kiwi.Variable()
const width = new kiwi.Variable()
solver.addEditVariable(left, kiwi.Strength.strong)
solver.addEditVariable(width, kiwi.Strength.strong)

// Create a variable calculated through a constraint
const centerX = new kiwi.Variable()
const expr = new kiwi.Expression([-1, centerX], left, [0.5, width])
solver.addConstraint(new kiwi.Constraint(expr, kiwi.Operator.Eq, kiwi.Strength.required))

// Suggest some values to the solver
solver.suggestValue(left, 0)
solver.suggestValue(width, 500)

// Lets solve the problem!
solver.updateVariables()

console.assert(centerX.value() === 250)
```

# API Documentation

- [@lume/kiwi](#module_@lume/kiwi)
  - [~Variable](#module_@lume/kiwi..Variable)
    - [new Variable([name])](#new_module_@lume/kiwi..Variable_new)
    - [.name()](#module_@lume/kiwi..Variable+name) ⇒ <code>String</code>
    - [.setName(name)](#module_@lume/kiwi..Variable+setName)
    - [.value()](#module_@lume/kiwi..Variable+value) ⇒ <code>Number</code>
    - [.subscribe(callback)](#module_@lume/kiwi..Variable+subscribe)
    - [.unsubscribe()](#module_@lume/kiwi..Variable+unsubscribe)
    - [.plus(value)](#module_@lume/kiwi..Variable+plus) ⇒ <code>Expression</code>
    - [.minus(value)](#module_@lume/kiwi..Variable+minus) ⇒ <code>Expression</code>
    - [.multiply(coefficient)](#module_@lume/kiwi..Variable+multiply) ⇒ <code>Expression</code>
    - [.divide(coefficient)](#module_@lume/kiwi..Variable+divide) ⇒ <code>Expression</code>
  - [~Expression](#module_@lume/kiwi..Expression)
    - [new Expression(...args)](#new_module_@lume/kiwi..Expression_new)
    - [.plus(value)](#module_@lume/kiwi..Expression+plus) ⇒ <code>Expression</code>
    - [.minus(value)](#module_@lume/kiwi..Expression+minus) ⇒ <code>Expression</code>
    - [.multiply(coefficient)](#module_@lume/kiwi..Expression+multiply) ⇒ <code>Expression</code>
    - [.divide(coefficient)](#module_@lume/kiwi..Expression+divide) ⇒ <code>Expression</code>
  - [~Strength](#module_@lume/kiwi..Strength)
    - _instance_
      - [.required](#module_@lume/kiwi..Strength+required)
      - [.strong](#module_@lume/kiwi..Strength+strong)
      - [.medium](#module_@lume/kiwi..Strength+medium)
      - [.weak](#module_@lume/kiwi..Strength+weak)
    - _static_
      - [.create(a, b, c, [w])](#module_@lume/kiwi..Strength.create) ⇒
  - [~Constraint](#module_@lume/kiwi..Constraint)
    - [new Constraint(expression, operator, [rhs], [strength])](#new_module_@lume/kiwi..Constraint_new)
    - [.expression()](#module_@lume/kiwi..Constraint+expression) ⇒ <code>Expression</code>
    - [.op()](#module_@lume/kiwi..Constraint+op) ⇒ <code>Operator</code>
    - [.strength()](#module_@lume/kiwi..Constraint+strength) ⇒ <code>Number</code>
  - [~Solver](#module_@lume/kiwi..Solver)
    - [new Solver()](#new_module_@lume/kiwi..Solver_new)
    - [.maxIterations](#module_@lume/kiwi..Solver+maxIterations) : <code>number</code>
    - [.createConstraint(lhs, operator, rhs, [strength])](#module_@lume/kiwi..Solver+createConstraint)
    - [.addConstraint(constraint)](#module_@lume/kiwi..Solver+addConstraint)
    - [.removeConstraint(constraint)](#module_@lume/kiwi..Solver+removeConstraint)
    - [.hasConstraint(constraint)](#module_@lume/kiwi..Solver+hasConstraint) ⇒ <code>Bool</code>
    - [.addEditVariable(variable, strength)](#module_@lume/kiwi..Solver+addEditVariable)
    - [.removeEditVariable(variable)](#module_@lume/kiwi..Solver+removeEditVariable)
    - [.hasEditVariable(variable)](#module_@lume/kiwi..Solver+hasEditVariable) ⇒ <code>Bool</code>
    - [.suggestValue(variable, value)](#module_@lume/kiwi..Solver+suggestValue)
    - [.updateVariables()](#module_@lume/kiwi..Solver+updateVariables)
  - [~Operator](#module_@lume/kiwi..Operator) : <code>enum</code>

<a name="module_@lume/kiwi..Variable"></a>

## @lume/kiwi~Variable

The primary user constraint variable.

**Kind**: inner class of [<code>@lume/kiwi</code>](#module_@lume/kiwi)

- [~Variable](#module_@lume/kiwi..Variable)
  - [new Variable([name])](#new_module_@lume/kiwi..Variable_new)
  - [.name()](#module_@lume/kiwi..Variable+name) ⇒ <code>String</code>
  - [.setName(name)](#module_@lume/kiwi..Variable+setName)
  - [.value()](#module_@lume/kiwi..Variable+value) ⇒ <code>Number</code>
  - [.subscribe(callback)](#module_@lume/kiwi..Variable+subscribe)
  - [.unsubscribe()](#module_@lume/kiwi..Variable+unsubscribe)
  - [.plus(value)](#module_@lume/kiwi..Variable+plus) ⇒ <code>Expression</code>
  - [.minus(value)](#module_@lume/kiwi..Variable+minus) ⇒ <code>Expression</code>
  - [.multiply(coefficient)](#module_@lume/kiwi..Variable+multiply) ⇒ <code>Expression</code>
  - [.divide(coefficient)](#module_@lume/kiwi..Variable+divide) ⇒ <code>Expression</code>

<a name="new_module_@lume/kiwi..Variable_new"></a>

### new Variable([name])

| Param  | Type                | Default                   | Description                               |
| ------ | ------------------- | ------------------------- | ----------------------------------------- |
| [name] | <code>String</code> | <code>&quot;&quot;</code> | The name to associated with the variable. |

<a name="module_@lume/kiwi..Variable+name"></a>

### variable.name() ⇒ <code>String</code>

Returns the name of the variable.

**Kind**: instance method of [<code>Variable</code>](#module_@lume/kiwi..Variable)  
**Returns**: <code>String</code> - name of the variable  
<a name="module_@lume/kiwi..Variable+setName"></a>

### variable.setName(name)

Set the name of the variable.

**Kind**: instance method of [<code>Variable</code>](#module_@lume/kiwi..Variable)

| Param | Type                | Description          |
| ----- | ------------------- | -------------------- |
| name  | <code>String</code> | Name of the variable |

<a name="module_@lume/kiwi..Variable+value"></a>

### variable.value() ⇒ <code>Number</code>

Returns the value of the variable.

**Kind**: instance method of [<code>Variable</code>](#module_@lume/kiwi..Variable)  
**Returns**: <code>Number</code> - Calculated value  
<a name="module_@lume/kiwi..Variable+subscribe"></a>

### variable.subscribe(callback)

Set a callback for whenever the value changes.

**Kind**: instance method of [<code>Variable</code>](#module_@lume/kiwi..Variable)

| Param    | Type                  | Description                                 |
| -------- | --------------------- | ------------------------------------------- |
| callback | <code>function</code> | to call whenever the variable value changes |

<a name="module_@lume/kiwi..Variable+unsubscribe"></a>

### variable.unsubscribe()

Stops the variable from calling the callback when the variable value
changes.

**Kind**: instance method of [<code>Variable</code>](#module_@lume/kiwi..Variable)  
<a name="module_@lume/kiwi..Variable+plus"></a>

### variable.plus(value) ⇒ <code>Expression</code>

Creates a new Expression by adding a number, variable or expression
to the variable.

**Kind**: instance method of [<code>Variable</code>](#module_@lume/kiwi..Variable)  
**Returns**: <code>Expression</code> - expression

| Param | Type                                                                    | Description   |
| ----- | ----------------------------------------------------------------------- | ------------- |
| value | <code>Number</code> \| <code>Variable</code> \| <code>Expression</code> | Value to add. |

<a name="module_@lume/kiwi..Variable+minus"></a>

### variable.minus(value) ⇒ <code>Expression</code>

Creates a new Expression by substracting a number, variable or expression
from the variable.

**Kind**: instance method of [<code>Variable</code>](#module_@lume/kiwi..Variable)  
**Returns**: <code>Expression</code> - expression

| Param | Type                                                                    | Description         |
| ----- | ----------------------------------------------------------------------- | ------------------- |
| value | <code>Number</code> \| <code>Variable</code> \| <code>Expression</code> | Value to substract. |

<a name="module_@lume/kiwi..Variable+multiply"></a>

### variable.multiply(coefficient) ⇒ <code>Expression</code>

Creates a new Expression by multiplying with a fixed number.

**Kind**: instance method of [<code>Variable</code>](#module_@lume/kiwi..Variable)  
**Returns**: <code>Expression</code> - expression

| Param       | Type                | Description                   |
| ----------- | ------------------- | ----------------------------- |
| coefficient | <code>Number</code> | Coefficient to multiply with. |

<a name="module_@lume/kiwi..Variable+divide"></a>

### variable.divide(coefficient) ⇒ <code>Expression</code>

Creates a new Expression by dividing with a fixed number.

**Kind**: instance method of [<code>Variable</code>](#module_@lume/kiwi..Variable)  
**Returns**: <code>Expression</code> - expression

| Param       | Type                | Description               |
| ----------- | ------------------- | ------------------------- |
| coefficient | <code>Number</code> | Coefficient to divide by. |

<a name="module_@lume/kiwi..Expression"></a>

## @lume/kiwi~Expression

An expression of variable terms and a constant.

The constructor accepts an arbitrary number of parameters,
each of which must be one of the following types:

- number
- Variable
- Expression
- 2-tuple of [number, Variable|Expression]

The parameters are summed. The tuples are multiplied.

**Kind**: inner class of [<code>@lume/kiwi</code>](#module_@lume/kiwi)

- [~Expression](#module_@lume/kiwi..Expression)
  - [new Expression(...args)](#new_module_@lume/kiwi..Expression_new)
  - [.plus(value)](#module_@lume/kiwi..Expression+plus) ⇒ <code>Expression</code>
  - [.minus(value)](#module_@lume/kiwi..Expression+minus) ⇒ <code>Expression</code>
  - [.multiply(coefficient)](#module_@lume/kiwi..Expression+multiply) ⇒ <code>Expression</code>
  - [.divide(coefficient)](#module_@lume/kiwi..Expression+divide) ⇒ <code>Expression</code>

<a name="new_module_@lume/kiwi..Expression_new"></a>

### new Expression(...args)

| Param   | Type                                                                                          |
| ------- | --------------------------------------------------------------------------------------------- |
| ...args | <code>number</code> \| <code>Variable</code> \| <code>Expression</code> \| <code>Array</code> |

<a name="module_@lume/kiwi..Expression+plus"></a>

### expression.plus(value) ⇒ <code>Expression</code>

Creates a new Expression by adding a number, variable or expression
to the expression.

**Kind**: instance method of [<code>Expression</code>](#module_@lume/kiwi..Expression)  
**Returns**: <code>Expression</code> - expression

| Param | Type                                                                    | Description   |
| ----- | ----------------------------------------------------------------------- | ------------- |
| value | <code>Number</code> \| <code>Variable</code> \| <code>Expression</code> | Value to add. |

<a name="module_@lume/kiwi..Expression+minus"></a>

### expression.minus(value) ⇒ <code>Expression</code>

Creates a new Expression by substracting a number, variable or expression
from the expression.

**Kind**: instance method of [<code>Expression</code>](#module_@lume/kiwi..Expression)  
**Returns**: <code>Expression</code> - expression

| Param | Type                                                                    | Description         |
| ----- | ----------------------------------------------------------------------- | ------------------- |
| value | <code>Number</code> \| <code>Variable</code> \| <code>Expression</code> | Value to substract. |

<a name="module_@lume/kiwi..Expression+multiply"></a>

### expression.multiply(coefficient) ⇒ <code>Expression</code>

Creates a new Expression by multiplying with a fixed number.

**Kind**: instance method of [<code>Expression</code>](#module_@lume/kiwi..Expression)  
**Returns**: <code>Expression</code> - expression

| Param       | Type                | Description                   |
| ----------- | ------------------- | ----------------------------- |
| coefficient | <code>Number</code> | Coefficient to multiply with. |

<a name="module_@lume/kiwi..Expression+divide"></a>

### expression.divide(coefficient) ⇒ <code>Expression</code>

Creates a new Expression by dividing with a fixed number.

**Kind**: instance method of [<code>Expression</code>](#module_@lume/kiwi..Expression)  
**Returns**: <code>Expression</code> - expression

| Param       | Type                | Description               |
| ----------- | ------------------- | ------------------------- |
| coefficient | <code>Number</code> | Coefficient to divide by. |

<a name="module_@lume/kiwi..Strength"></a>

## @lume/kiwi~Strength

**Kind**: inner class of [<code>@lume/kiwi</code>](#module_@lume/kiwi)

- [~Strength](#module_@lume/kiwi..Strength)
  - _instance_
    - [.required](#module_@lume/kiwi..Strength+required)
    - [.strong](#module_@lume/kiwi..Strength+strong)
    - [.medium](#module_@lume/kiwi..Strength+medium)
    - [.weak](#module_@lume/kiwi..Strength+weak)
  - _static_
    - [.create(a, b, c, [w])](#module_@lume/kiwi..Strength.create) ⇒

<a name="module_@lume/kiwi..Strength+required"></a>

### strength.required

The 'required' symbolic strength.

**Kind**: instance property of [<code>Strength</code>](#module_@lume/kiwi..Strength)  
<a name="module_@lume/kiwi..Strength+strong"></a>

### strength.strong

The 'strong' symbolic strength.

**Kind**: instance property of [<code>Strength</code>](#module_@lume/kiwi..Strength)  
<a name="module_@lume/kiwi..Strength+medium"></a>

### strength.medium

The 'medium' symbolic strength.

**Kind**: instance property of [<code>Strength</code>](#module_@lume/kiwi..Strength)  
<a name="module_@lume/kiwi..Strength+weak"></a>

### strength.weak

The 'weak' symbolic strength.

**Kind**: instance property of [<code>Strength</code>](#module_@lume/kiwi..Strength)  
<a name="module_@lume/kiwi..Strength.create"></a>

### Strength.create(a, b, c, [w]) ⇒

Create a new symbolic strength.

**Kind**: static method of [<code>Strength</code>](#module_@lume/kiwi..Strength)  
**Returns**: strength

| Param | Default        | Description |
| ----- | -------------- | ----------- |
| a     |                | strong      |
| b     |                | medium      |
| c     |                | weak        |
| [w]   | <code>1</code> | weight      |

<a name="module_@lume/kiwi..Constraint"></a>

## @lume/kiwi~Constraint

A linear constraint equation.

A constraint equation is composed of an expression, an operator,
and a strength. The RHS of the equation is implicitly zero.

**Kind**: inner class of [<code>@lume/kiwi</code>](#module_@lume/kiwi)

- [~Constraint](#module_@lume/kiwi..Constraint)
  - [new Constraint(expression, operator, [rhs], [strength])](#new_module_@lume/kiwi..Constraint_new)
  - [.expression()](#module_@lume/kiwi..Constraint+expression) ⇒ <code>Expression</code>
  - [.op()](#module_@lume/kiwi..Constraint+op) ⇒ <code>Operator</code>
  - [.strength()](#module_@lume/kiwi..Constraint+strength) ⇒ <code>Number</code>

<a name="new_module_@lume/kiwi..Constraint_new"></a>

### new Constraint(expression, operator, [rhs], [strength])

| Param      | Type                    | Default                        | Description                        |
| ---------- | ----------------------- | ------------------------------ | ---------------------------------- |
| expression | <code>Expression</code> |                                | The constraint expression (LHS).   |
| operator   | <code>Operator</code>   |                                | The equation operator.             |
| [rhs]      | <code>Expression</code> |                                | Right hand side of the expression. |
| [strength] | <code>Number</code>     | <code>Strength.required</code> | The strength of the constraint.    |

<a name="module_@lume/kiwi..Constraint+expression"></a>

### constraint.expression() ⇒ <code>Expression</code>

Returns the expression of the constraint.

**Kind**: instance method of [<code>Constraint</code>](#module_@lume/kiwi..Constraint)  
**Returns**: <code>Expression</code> - expression  
<a name="module_@lume/kiwi..Constraint+op"></a>

### constraint.op() ⇒ <code>Operator</code>

Returns the relational operator of the constraint.

**Kind**: instance method of [<code>Constraint</code>](#module_@lume/kiwi..Constraint)  
**Returns**: <code>Operator</code> - linear constraint operator  
<a name="module_@lume/kiwi..Constraint+strength"></a>

### constraint.strength() ⇒ <code>Number</code>

Returns the strength of the constraint.

**Kind**: instance method of [<code>Constraint</code>](#module_@lume/kiwi..Constraint)  
**Returns**: <code>Number</code> - strength  
<a name="module_@lume/kiwi..Solver"></a>

## @lume/kiwi~Solver

The constraint solver class.

**Kind**: inner class of [<code>@lume/kiwi</code>](#module_@lume/kiwi)

- [~Solver](#module_@lume/kiwi..Solver)
  - [new Solver()](#new_module_@lume/kiwi..Solver_new)
  - [.maxIterations](#module_@lume/kiwi..Solver+maxIterations) : <code>number</code>
  - [.createConstraint(lhs, operator, rhs, [strength])](#module_@lume/kiwi..Solver+createConstraint)
  - [.addConstraint(constraint)](#module_@lume/kiwi..Solver+addConstraint)
  - [.removeConstraint(constraint)](#module_@lume/kiwi..Solver+removeConstraint)
  - [.hasConstraint(constraint)](#module_@lume/kiwi..Solver+hasConstraint) ⇒ <code>Bool</code>
  - [.addEditVariable(variable, strength)](#module_@lume/kiwi..Solver+addEditVariable)
  - [.removeEditVariable(variable)](#module_@lume/kiwi..Solver+removeEditVariable)
  - [.hasEditVariable(variable)](#module_@lume/kiwi..Solver+hasEditVariable) ⇒ <code>Bool</code>
  - [.suggestValue(variable, value)](#module_@lume/kiwi..Solver+suggestValue)
  - [.updateVariables()](#module_@lume/kiwi..Solver+updateVariables)

<a name="new_module_@lume/kiwi..Solver_new"></a>

### new Solver()

Construct a new Solver.

<a name="module_@lume/kiwi..Solver+maxIterations"></a>

### solver.maxIterations : <code>number</code>

- The max number of solver iterations before an erroris thrown, in order to prevent infinite iteration. Default: `10,000`.

**Kind**: instance property of [<code>Solver</code>](#module_@lume/kiwi..Solver)  
<a name="module_@lume/kiwi..Solver+createConstraint"></a>

### solver.createConstraint(lhs, operator, rhs, [strength])

Creates and add a constraint to the solver.

**Kind**: instance method of [<code>Solver</code>](#module_@lume/kiwi..Solver)

| Param      | Type                                                                    | Default                        | Description                       |
| ---------- | ----------------------------------------------------------------------- | ------------------------------ | --------------------------------- |
| lhs        | <code>Expression</code> \| <code>Variable</code>                        |                                | Left hand side of the expression  |
| operator   | <code>Operator</code>                                                   |                                | Operator                          |
| rhs        | <code>Expression</code> \| <code>Variable</code> \| <code>Number</code> |                                | Right hand side of the expression |
| [strength] | <code>Number</code>                                                     | <code>Strength.required</code> | Strength                          |

<a name="module_@lume/kiwi..Solver+addConstraint"></a>

### solver.addConstraint(constraint)

Add a constraint to the solver.

**Kind**: instance method of [<code>Solver</code>](#module_@lume/kiwi..Solver)

| Param      | Type                    | Description                     |
| ---------- | ----------------------- | ------------------------------- |
| constraint | <code>Constraint</code> | Constraint to add to the solver |

<a name="module_@lume/kiwi..Solver+removeConstraint"></a>

### solver.removeConstraint(constraint)

Remove a constraint from the solver.

**Kind**: instance method of [<code>Solver</code>](#module_@lume/kiwi..Solver)

| Param      | Type                    | Description                          |
| ---------- | ----------------------- | ------------------------------------ |
| constraint | <code>Constraint</code> | Constraint to remove from the solver |

<a name="module_@lume/kiwi..Solver+hasConstraint"></a>

### solver.hasConstraint(constraint) ⇒ <code>Bool</code>

Test whether the solver contains the constraint.

**Kind**: instance method of [<code>Solver</code>](#module_@lume/kiwi..Solver)  
**Returns**: <code>Bool</code> - true or false

| Param      | Type                    | Description            |
| ---------- | ----------------------- | ---------------------- |
| constraint | <code>Constraint</code> | Constraint to test for |

<a name="module_@lume/kiwi..Solver+addEditVariable"></a>

### solver.addEditVariable(variable, strength)

Add an edit variable to the solver.

**Kind**: instance method of [<code>Solver</code>](#module_@lume/kiwi..Solver)

| Param    | Type                  | Description                                       |
| -------- | --------------------- | ------------------------------------------------- |
| variable | <code>Variable</code> | Edit variable to add to the solver                |
| strength | <code>Number</code>   | Strength, should be less than `Strength.required` |

<a name="module_@lume/kiwi..Solver+removeEditVariable"></a>

### solver.removeEditVariable(variable)

Remove an edit variable from the solver.

**Kind**: instance method of [<code>Solver</code>](#module_@lume/kiwi..Solver)

| Param    | Type                  | Description                             |
| -------- | --------------------- | --------------------------------------- |
| variable | <code>Variable</code> | Edit variable to remove from the solver |

<a name="module_@lume/kiwi..Solver+hasEditVariable"></a>

### solver.hasEditVariable(variable) ⇒ <code>Bool</code>

Test whether the solver contains the edit variable.

**Kind**: instance method of [<code>Solver</code>](#module_@lume/kiwi..Solver)  
**Returns**: <code>Bool</code> - true or false

| Param    | Type                  | Description               |
| -------- | --------------------- | ------------------------- |
| variable | <code>Variable</code> | Edit variable to test for |

<a name="module_@lume/kiwi..Solver+suggestValue"></a>

### solver.suggestValue(variable, value)

Suggest the value of an edit variable.

**Kind**: instance method of [<code>Solver</code>](#module_@lume/kiwi..Solver)

| Param    | Type                  | Description                          |
| -------- | --------------------- | ------------------------------------ |
| variable | <code>Variable</code> | Edit variable to suggest a value for |
| value    | <code>Number</code>   | Suggested value                      |

<a name="module_@lume/kiwi..Solver+updateVariables"></a>

### solver.updateVariables()

Update the values of the variables.

**Kind**: instance method of [<code>Solver</code>](#module_@lume/kiwi..Solver)  
<a name="module_@lume/kiwi..Operator"></a>

## @lume/kiwi~Operator : <code>enum</code>

An enum defining the linear constraint operators.

| Value | Operator | Description        |
| ----- | -------- | ------------------ |
| `Le`  | <=       | Less than equal    |
| `Ge`  | >=       | Greater than equal |
| `Eq`  | ==       | Equal              |

**Kind**: inner enum of [<code>@lume/kiwi</code>](#module_@lume/kiwi)
