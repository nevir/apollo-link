export function buildDelayFunction(_a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.initial, initial = _c === void 0 ? 300 : _c, _d = _b.max, max = _d === void 0 ? Infinity : _d, _e = _b.jitter, jitter = _e === void 0 ? true : _e;
    var baseDelay;
    if (jitter) {
        baseDelay = initial;
    }
    else {
        baseDelay = initial / 2;
    }
    return function delayFunction(count) {
        var delay = Math.min(max, baseDelay * Math.pow(2, count));
        if (jitter) {
            delay = Math.random() * delay;
        }
        return delay;
    };
}
//# sourceMappingURL=delayFunction.js.map