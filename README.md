![Image](https://github.com/user-attachments/assets/c23cfc96-cb04-483b-83cf-d33332322dd9)

LUME Kiwi is a fast TypeScript implementation of the [Cassowary constraint
solving algorithm](<https://en.wikipedia.org/wiki/Cassowary_(software)>), based on the seminal Cassowary paper. Originally created by
Chris Colbert, it was redesigned from the ground up to be lightweight, fast and
easy to maintain. View the [benchmarks](#benchmarks) to see how it compares to
[Cassowary.js](https://github.com/slightlyoff/cassowary.js).

Soon it will be compiled to
[WebAssembly](https://developer.mozilla.org/en-US/docs/WebAssembly) with
[AssemblyScript](http://assemblyscript.org) (TypeScript to WebAssembly
compiler).

## Index

- [Demo](#demo)
- [Install](#install)
- [Usage](#usage)
- [Documentation](#documentation)
- [Benchmarks](#benchmarks)
- [Tests](#tests)

## Demo

[Live demo on CodePen.](https://codepen.io/trusktr/pen/abMLVxa?editors=1010)

## Install

### Local Install

Install using NPM:

```sh
npm install @lume/kiwi
```

If you have a plain web app with no build, or a non-browser JS runtime that also
supports import maps like Deno, you'll need to add `@lume/kiwi` to your
`importmap` script so that the browser or JS runtime knows where to import kiwi from. F.e.
something like this:

```html
<script type="importmap">
  {
    "imports": {
      "@lume/kiwi": "./node_modules/@lume/kiwi/dist/kiwi.js"
    }
  }
</script>
```

### CDN Install

Note, if using importmaps and native ES Modules in a browser, or in a JS runtime like Deno, you can get Kiwi directly from the UNPKG CDN without installing it locally (just as the [live CodePen demo](#demo) does):

```html
<script type="importmap">
  {
    "imports": {
      "@lume/kiwi": "https://unpkg.com/@lume/kiwi@0.4.2/dist/kiwi.js"
    }
  }
</script>
```

## Usage

After installing, import kiwi into your project:

```js
import * as kiwi from '@lume/kiwi'

console.log(kiwi)

// ...use kiwi...
```

The following example creates a solver which automatically calculates a width based on some constraints:

```js
// Create a solver
var solver = new kiwi.Solver()

// Create edit variables
var left = new kiwi.Variable()
var width = new kiwi.Variable()
solver.addEditVariable(left, kiwi.Strength.strong)
solver.addEditVariable(width, kiwi.Strength.strong)
solver.suggestValue(left, 100)
solver.suggestValue(width, 400)

// Create and add a constraint
var right = new kiwi.Variable()
solver.addConstraint(new kiwi.Constraint(new kiwi.Expression([-1, right], left, width), kiwi.Operator.Eq))

// Solve the constraints
solver.updateVariables()

console.assert(right.value() === 500)

// later, update the constraints and re-calculate
setTimeout(() => {
  solver.suggestValue(left, 200)
  solver.suggestValue(width, 600)

  solver.updateVariables() // update

  console.assert(right.value() === 800)
}, 2000)
```

## Documentation

- [API Reference](docs/Kiwi.md)

## Benchmarks

To run the benchmark in the browser, [just visit this page](https://raw.githack.com/lume/kiwi/main/bench/index.html).

To run the benchmark locally using nodejs, _clone or download this repository_ and execute the following steps:

    npm install
    npm run bench

Statically serve the project, f.e. `npx five-server .` which opens a new browser
tab, then visit `/bench/index.html` to verify that the benchmark also runs in a
browser.

Sample result output:

```
----- Running creation benchmark...
Cassowary.js x 2,597 ops/sec ±1.56% (93 runs sampled)
kiwi x 26,243 ops/sec ±1.34% (91 runs sampled)
kiwi new API x 20,840 ops/sec ±7.19% (80 runs sampled)
Fastest is kiwi (± 10.11x faster)
----- Running solving benchmark...
Cassowary.js x 260,002 ops/sec ±2.62% (89 runs sampled)
kiwi x 595,455 ops/sec ±1.74% (89 runs sampled)
Fastest is kiwi (± 2.29x faster)
```

## Tests

To run the tests in the browser, [just visit this page](https://raw.githack.com/lume/kiwi/main/test/index.html).

To run the tests locally using nodejs, _clone or download this repository_ and execute the following steps:

    npm install
    npm run build && npm run test

Start a static server, f.e. `npx five-server .` which opens a new browser tab,
and visit `/test/index.html` to verify that tests also pass in a browser.

## Contribute

If you like this project and want to support it, show some love and give it a
star, try it and report any bugs, write new feature ideas, or even
open a pull request!

## License

© 2013 Nucleic Development Team
© 2021 Joseph Orbegoso Pea (http://github.com/trusktr)
© 2021 Lume

[![License](https://img.shields.io/badge/license-BDS%203--clause-brightgreen)](<https://tldrlegal.com/license/bsd-3-clause-license-(revised)>)

## Status

[![Build Status](https://github.com/lume/kiwi/actions/workflows/tests.yml/badge.svg)](https://github.com/lume/kiwi/actions/workflows/tests.yml)

<!--
TODO coverage status
[![codecov](https://codecov.io/gh/IjzerenHein/kiwi.js/branch/master/graph/badge.svg)](https://codecov.io/gh/IjzerenHein/kiwi.js)
-->
