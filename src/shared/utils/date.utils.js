function toDateOnly(value) {
    // value can be Date, string (YYYY-MM-DD), etc.
    const d = (value instanceof Date) ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function isWithinRange(date, start, end) {
    const d = toDateOnly(date);
    const s = toDateOnly(start);
    const e = toDateOnly(end);
    if (!d || !s || !e) return false;
    // inclusive range
    return d.getTime() >= s.getTime() && d.getTime() <= e.getTime();
}

function isPast(date) {
    const d = toDateOnly(date);
    if (!d) return false;
    const today = toDateOnly(new Date());
    return d.getTime() < today.getTime();
}

module.exports = { toDateOnly, isWithinRange, isPast };
