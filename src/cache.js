/*
 * Copyright (C) 2012-2014 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file COPYING for license details.
 */

/*
 * OBSOLETE/UNUSED
 *
 * Caching module to cache the 'data' attribute of files. This enables data
 * to survive reloads of directories. In future, will enable us to do some
 * primitive but very necessary memory management, purging large objects
 * which haven't been used in a while.
 *
 * It is best to use the cache for data which has been transformed at some
 * cost. No point caching raw HTTP responses which are anyway being handled
 * by the browser's caching engine, which will automatically take care of
 * validation, expiry, etc.
 *
 * TODO Cache ranges of objects
 * TODO Store time of entry, monitor size of cache, purge old entries to get
 *   size to target
 */

var cache = (function(){
    var cache = {cacheMap: {}};
    cache.add = function(key, value, cookie) {
        this.cacheMap[key] = {data: value, cookie: cookie};
    };
    cache.remove = function(key) {
        delete this.cacheMap[key];
    };
    cache.get = function(key, cookie, inval) {
        var entry = this.cacheMap[key];
        if (entry === undefined) {
            return undefined;
        }
        if (cookie === undefined) {
            return entry;
        }
        if (entry['cookie'] != cookie) {
            if (inval === true) {
                cache.remove(key);
            }
            return undefined;
        }
        return entry['data'];
    };
    return cache;
})();
