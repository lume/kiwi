/**
 * @class Strength
 */
var Strength = /** @class */ (function () {
    function Strength() {
    }
    /**
     * Create a new symbolic strength.
     *
     * @param a strong
     * @param b medium
     * @param c weak
     * @param [w] weight
     * @return strength
     */
    Strength.create = function (a, b, c, w) {
        if (w === void 0) { w = 1.0; }
        var result = 0.0;
        result += Math.max(0.0, Math.min(1000.0, a * w)) * 1000000.0;
        result += Math.max(0.0, Math.min(1000.0, b * w)) * 1000.0;
        result += Math.max(0.0, Math.min(1000.0, c * w));
        return result;
    };
    /**
     * Clip a symbolic strength to the allowed min and max.
     * @private
     */
    Strength.clip = function (value) {
        return Math.max(0.0, Math.min(Strength.required, value));
    };
    /**
     * The 'required' symbolic strength.
     */
    Strength.required = Strength.create(1000.0, 1000.0, 1000.0);
    /**
     * The 'strong' symbolic strength.
     */
    Strength.strong = Strength.create(1.0, 0.0, 0.0);
    /**
     * The 'medium' symbolic strength.
     */
    Strength.medium = Strength.create(0.0, 1.0, 0.0);
    /**
     * The 'weak' symbolic strength.
     */
    Strength.weak = Strength.create(0.0, 0.0, 1.0);
    return Strength;
}());
export { Strength };
