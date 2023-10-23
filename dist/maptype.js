export function createMap() {
    return new IndexedMap();
}
class IndexedMap {
    index = {};
    array = [];
    /**
     * Returns the number of items in the array.
     */
    size() {
        return this.array.length;
    }
    /**
     * Returns true if the array is empty.
     */
    empty() {
        return this.array.length === 0;
    }
    /**
     * Returns the item at the given array index.
     *
     * @param index The integer index of the desired item.
     */
    itemAt(index) {
        return this.array[index];
    }
    /**
     * Returns true if the key is in the array, false otherwise.
     *
     * @param key The key to locate in the array.
     */
    contains(key) {
        return this.index[key.id()] !== undefined;
    }
    /**
     * Returns the pair associated with the given key, or undefined.
     *
     * @param key The key to locate in the array.
     */
    find(key) {
        const i = this.index[key.id()];
        return i === undefined ? undefined : this.array[i];
    }
    /**
     * Returns the pair associated with the key if it exists.
     *
     * If the key does not exist, a new pair will be created and
     * inserted using the value created by the given factory.
     *
     * @param key The key to locate in the array.
     * @param factory The function which creates the default value.
     */
    setDefault(key, factory) {
        const i = this.index[key.id()];
        if (i === undefined) {
            const pair = new Pair(key, factory());
            this.index[key.id()] = this.array.length;
            this.array.push(pair);
            return pair;
        }
        else {
            return this.array[i];
        }
    }
    /**
     * Insert the pair into the array and return the pair.
     *
     * This will overwrite any existing entry in the array.
     *
     * @param key The key portion of the pair.
     * @param value The value portion of the pair.
     */
    insert(key, value) {
        const pair = new Pair(key, value);
        const i = this.index[key.id()];
        if (i === undefined) {
            this.index[key.id()] = this.array.length;
            this.array.push(pair);
        }
        else {
            this.array[i] = pair;
        }
        return pair;
    }
    /**
     * Removes and returns the pair for the given key, or undefined.
     *
     * @param key The key to remove from the map.
     */
    erase(key) {
        const i = this.index[key.id()];
        if (i === undefined) {
            return undefined;
        }
        this.index[key.id()] = undefined;
        const pair = this.array[i];
        const last = this.array.pop();
        if (pair !== last) {
            this.array[i] = last;
            this.index[last.first.id()] = i;
        }
        return pair;
    }
    /**
     * Create a copy of this associative array.
     */
    copy() {
        const copy = new IndexedMap();
        for (let i = 0; i < this.array.length; i++) {
            const pair = this.array[i].copy();
            copy.array[i] = pair;
            copy.index[pair.first.id()] = i;
        }
        return copy;
    }
}
/**
 * A class which defines a generic pair object.
 * @private
 */
// tslint:disable: max-classes-per-file
class Pair {
    first;
    second;
    /**
     * Construct a new Pair object.
     *
     * @param first The first item of the pair.
     * @param second The second item of the pair.
     */
    constructor(first, second) {
        this.first = first;
        this.second = second;
    }
    /**
     * Create a copy of the pair.
     */
    copy() {
        return new Pair(this.first, this.second);
    }
}
