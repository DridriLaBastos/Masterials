class IArray {

    static toImmutable( thisArg ) {
        thisArg = thisArg || this;
        if ( !( thisArg instanceof IArray ) ) {
            if (
                thisArg instanceof Array
                || Symbol.iterator in thisArg &&
                typeof thisArg.length !== 'undefined' &&
                typeof thisArg[0] !== 'undefined'
            ) {
                return Object.freeze( Object.setPrototypeOf( thisArg, IArray.prototype ) );
            }
            else {
                throw new Error( 'Please use IArray.from' );
            }
        }
        throw new Error( 'It is already an IArray' );
    }

    static from() {
        switch ( arguments.length ) {
            case 0: {
                return undefined;
            }
            case 1: {
                const IterableSource = arguments[0];
                if ( IterableSource && Symbol.iterator in IterableSource ) {
                    return IArray.from( IterableSource );
                }
                else if ( IterableSource && typeof IterableSource === 'object' ) {
                    const Mutable = [];
                    for ( const property in IterableSource ) {
                        if ( Object.prototype.hasOwnProperty.call( IterableSource, property ) ) {
                            Mutable.push( IterableSource[property] );
                        }
                    }
                    return IArray.toImmutable( Mutable );
                }
                return undefined;
            }
            default: {
                return IArray.toImmutable( arguments );
            }
        }
    }

    static isIArray( value ) {
        return Object.getPrototypeOf( value ) === IArray.prototype && 'length' in value && Object.isFrozen( value );
    }

    static [Symbol.hasInstance]( instance ) {
        return IArray.isIArray( instance );
    }

    constructor () {
        this.length = 0;
        for ( let i = 0, { length } = arguments; i < length; i += 1 ) {
            this[this.length++] = arguments[i];
        }
        Object.freeze( this );
    }

    [Symbol.iterator]() {
        const { length } = this;
        let i = 0;
        return Object.assign( Object.create( null ), {
            next: () => Object.assign( Object.create( null ), {
                value: i < length ? this[i] : undefined,
                done: !( i++ < length )
            } )
        } );
    }

    at( i ) {
        return i < 0 ? this[this.length + i] : i;
    }

    values() {
        return Object.assign( Object.create( null ), {
            [Symbol.iterator]: this[Symbol.iterator]
        } );
    }

    entries() {
        return Object.assign( Object.create( null ), {
            [Symbol.iterator]: () => {
                const { length } = this;
                let i = 0;
                return Object.assign( Object.create( null ), {
                    next: () => Object.assign( Object.create( null ), {
                        value: i < length ? new IArray( i, this[i] ) : undefined,
                        done: !( i++ < length )
                    } )
                } );
            }
        } );
    }

    keys() {
        return Object.assign( Object.create( null ), {
            [Symbol.iterator]: () => {
                const { length } = this;
                let i = 0;
                return Object.assign( Object.create( null ), {
                    next: () => Object.assign( Object.create( null ), {
                        value: i < length ? i : undefined,
                        done: !( i++ < length )
                    } )
                } );
            }
        } );
    }

    forEach( callback, thisArg ) {
        thisArg = thisArg || this;
        for ( let i = 0, { length } = thisArg; i < length; i += 1 ) {
            callback( thisArg[i], i, thisArg );
        }
    }

    includes( valueToFind, fromIndex ) {
        for ( let { length } = this, i = fromIndex >= 0 && fromIndex < length ? fromIndex : 0; i < length; i += 1 ) {
            if ( Object.is( this[i], valueToFind ) ) {
                return true;
            }
        }
        return false;
    }

    indexOf( searchElement, fromIndex ) {
        for ( let { length } = this, i = fromIndex >= 0 && fromIndex < length ? fromIndex : 0; i < length; i += 1 ) {
            if ( Object.is( this[i], searchElement ) ) {
                return i;
            }
        }
        return -1;
    }

    lastIndexOf( searchElement, fromIndex ) {
        for ( let { length } = this, i = fromIndex >= 0 && fromIndex < length ? fromIndex : length; i > 0; i -= 1 ) {
            if ( Object.is( this[i], searchElement ) ) {
                return i;
            }
        }
        return -1;
    }

    map( callback, thisArg ) {
        thisArg = thisArg || this;
        const Mutable = [];
        for ( let i = 0, { length } = thisArg; i < length; i += 1 ) {
            Mutable.push( callback( thisArg[i], i, thisArg ) );
        }
        return IArray.toImmutable( Mutable );
    }

    reduce( callback, initialValue ) {
        let accumulator = initialValue || this[0];
        for ( let i = 0, { length } = this; i < length; i += 1 ) {
            accumulator = callback( accumulator, this[i], i, this );
        }
        return accumulator;
    }

    reduceRight( callback, initialValue ) {
        const { length } = this;
        let acc = initialValue || this[length - 1];
        for ( let i = length; i > 0; i -= 1 ) {
            acc = callback( acc, this[i], i, this );
        }
        return acc;
    }

    filter( callback, thisArg ) {
        thisArg = thisArg || this;
        const Mutable = [];
        for ( let i = 0, { length } = thisArg; i < length; i += 1 ) {
            if ( callback( thisArg[i], i, thisArg ) ) {
                Mutable.push( thisArg[i] );
            }
        }
        return IArray.toImmutable( Mutable );
    }

    every( callback, thisArg ) {
        thisArg = thisArg || this;
        for ( let i = 0, { length } = thisArg; i < length; i += 1 ) {
            if ( !callback( thisArg[i], i, thisArg ) ) {
                return false;
            }
        }
        return true;
    }

    some( callback, thisArg ) {
        thisArg = thisArg || this;
        for ( let i = 0, { length } = thisArg; i < length; i += 1 ) {
            if ( callback( thisArg[i], i, thisArg ) ) {
                return true;
            }
        }
        return false;
    }

    find( callback, thisArg ) {
        thisArg = thisArg || this;
        for ( let i = 0, { length } = thisArg; i < length; i += 1 ) {
            const curr = thisArg[i];
            if ( callback( curr, i, thisArg ) ) {
                return curr;
            }
        }
        return undefined;
    }

    findIndex( callback, thisArg ) {
        thisArg = thisArg || this;
        for ( let i = 0, { length } = thisArg; i < length; i += 1 ) {
            if ( callback( thisArg[i], i, thisArg ) ) {
                return i;
            }
        }
        return -1;
    }

    reverse() {
        const Mutable = [];
        for ( let i = this.length; i > 0; i -= 1 ) {
            Mutable.push( this[i] );
        }
        return IArray.toImmutable( Mutable );
    }

    slice( start, end ) {
        const Mutable = [];
        for ( let { length } = this, i = start >= 0 && start < length ? start : 0, elements = end >= 0 && end <= length ? end : length; i < elements; i += 1 ) {
            Mutable.push( this[i] );
        }
        return IArray.toImmutable( Mutable );
    }

    splice( start, deleteCount, ...items ) {
        const { length } = this;
        const Mutable = [];
        deleteCount = arguments.length === 1 ? length - start : deleteCount >= 0 ? deleteCount : 0;
        for ( let i = 0, itemsLength = items.length; i < length; i += 1 ) {
            if ( i === start ) {
                if ( itemsLength ) {
                    for ( let itemIndex = 0; itemIndex < itemsLength; itemIndex += 1 ) {
                        Mutable.push( items[itemIndex] );
                        if ( ( deleteCount -= 1 ) > 0 ) {
                            i += 1;
                        }
                    }
                }
            }
            else if ( i > start ) {
                while ( ( deleteCount -= 1 ) > 0 && i < length ) {
                    i += 1;
                }
                if ( i < length ) {
                    Mutable.push( this[i] );
                }
            }
            else {
                Mutable.push( this[i] );
            }
        }
        return IArray.toImmutable( Mutable );
    }

    flatMap( callback, thisArg ) {
        thisArg = thisArg || this;
        const Mutable = [];
        for ( let i = 0, { length } = thisArg; i < length; i += 1 ) {
            const item = callback( thisArg[i], i, thisArg );
            if ( item instanceof IArray || item instanceof Array ) {
                for ( const lowItem of item ) {
                    if ( typeof lowItem !== 'undefined' ) {
                        Mutable.push( lowItem );
                    }
                }
            }
            else if ( typeof item !== 'undefined' ) {
                Mutable.push( item );
            }
        }
        return IArray.toImmutable( Mutable );
    }

    concat() {
        const Mutable = [...this];
        for ( let i = 0, { length } = arguments; i < length; i += 1 ) {
            if ( arguments[i] instanceof IArray || arguments[i] instanceof Array ) {
                Mutable.push( ...( arguments[i] ) );
            }
            else {
                Mutable.push( arguments[i] );
            }
        }
        return IArray.toImmutable( Mutable );
    }

    copyWithin( target, start, end ) {
        const Mutable = [];
        const { length } = this;
        if ( target > length ) {
            return this;
        }
        const startFix = typeof start === 'undefined' ? 0 : start < 0 ? length + start : start > length ? length : start;
        const endFix = typeof end === 'undefined' ? length : end < 0 ? length + end : end > length ? length : end;
        let [toCopy, startCopy] = startFix < endFix ? [endFix - startFix, startFix] : [startFix - endFix, endFix];
        for ( let i = 0; i < length; i += 1 ) {
            if ( i >= target && toCopy-- > 0 ) {
                Mutable.push( this[startCopy++] );
            }
            else {
                Mutable.push( this[i] );
            }
        }
        return IArray.toImmutable( Mutable );
    }

    join( separator ) {
        let string = '';
        for ( let i = 0, { length } = this; i < length; i += 1 ) {
            string = `${string}${separator}${this[i]}`;
        }
        return string;
    }

    sort( callback ) {
        callback = callback || ( ( a, b ) => a < b ? -1 : a > b ? 1 : 0 );
        const { length } = this;
        if ( length <= 1 ) { return this; }
        const middle = Math.floor( length / 2 );
        const left = this.slice( 0, middle );
        const right = this.slice( middle );

        const merge = ( left, right ) => {
            const Mutable = [];
            let leftIndex = 0;
            let rightIndex = 0;

            while ( leftIndex < left.length && rightIndex < right.length ) {
                if ( callback( left[leftIndex], right[rightIndex] ) < 0 ) {
                    Mutable.push( left[leftIndex++] );
                } else {
                    Mutable.push( right[rightIndex++] );
                }
            }

            for ( let i = leftIndex, length = left.length; i < length; i += 1 ) {
                Mutable.push( left[i] );
            }
            for ( let i = rightIndex, length = right.length; i < length; i += 1 ) {
                Mutable.push( right[i] );
            }

            return IArray.toImmutable( Mutable );
        };

        return IArray.toImmutable( merge( left.sort( callback ), right.sort( callback ) ) );

    }
};

export { IArray };