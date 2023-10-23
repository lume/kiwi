const license = /*js*/ `
/*-----------------------------------------------------------------------------
| Copyright (c) 2014-2019, Nucleic Development Team & H. Rutjes & Lume.
|
| Distributed under the terms of the Modified BSD License.
|
| The full license is in the file COPYING.txt, distributed with this software.
-----------------------------------------------------------------------------*/
`,
	banner =
		license +
		/*js*/ `
/**
 * Lume Kiwi is an efficient implementation of the Cassowary constraint solving
 * algorithm, based on the seminal Cassowary paper.
 * It is *not* a refactoring or port of the original C++ solver, but
 * has been designed from the ground up to be lightweight and fast.
 *
 * **Example**
 *
 * \`\`\`javascript
 * import * as kiwi from '@lume/kiwi';
 *
 * // Create a solver
 * const solver = new kiwi.Solver();
 *
 * // Adjust the max number of solver iterations before an error is thrown if
 * // more is needed. Default is 10,000.
 * solver.maxIterations = 20000;
 *
 * // Create and add some editable variables
 * const left = new kiwi.Variable();
 * const width = new kiwi.Variable();
 * solver.addEditVariable(left, kiwi.Strength.strong);
 * solver.addEditVariable(width, kiwi.Strength.strong);
 *
 * // Create a variable calculated through a constraint
 * const centerX = new kiwi.Variable();
 * const expr = new kiwi.Expression([-1, centerX], left, [0.5, width]);
 * solver.addConstraint(new kiwi.Constraint(expr, kiwi.Operator.Eq, kiwi.Strength.required));
 *
 * // Suggest some values to the solver
 * solver.suggestValue(left, 0);
 * solver.suggestValue(width, 500);
 *
 * // Lets solve the problem!
 * solver.updateVariables();
 *
 * console.assert(centerX.value() === 250);
 * \`\`\`
 *
 * ## API Documentation
 * @module @lume/kiwi
 */
`
// we generate three output formats:
// - a fully ES6 version in tmp/kiwi.js, used just as the input to jsdoc2md.

const doc = {
	input: 'dist/kiwi.js',
	output: {
		name: 'kiwi',
		exports: 'named',
		banner,
		file: 'tmp/kiwi.js',
		format: 'es',
	},
}

export default [doc]
