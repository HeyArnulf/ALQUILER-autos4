export const MAX_DURATION_DISCOUNT = 0.15;

export const RENTAL_RATE_TIERS = Object.freeze([
    { minDays: 1, maxDays: 2, discount: 0 },
    { minDays: 3, maxDays: 7, discount: 0.05 },
    { minDays: 8, maxDays: 29, discount: 0.1 },
    { minDays: 30, maxDays: Infinity, discount: 0.15 }
]);

function roundCurrency(amount) {
    return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function formatUSD(amount) {
    return `$${Number(amount || 0).toFixed(2)} USD`;
}

export function getRentalQuote(car, requestedDays = 1, extrasPerDay = 0) {
    const days = Math.max(1, Math.ceil(Number(requestedDays) || 1));
    const baseDailyRate = Math.max(0, Number(car?.precioDia) || 0);
    const extrasDailyRate = Math.max(0, Number(extrasPerDay) || 0);
    const tier = RENTAL_RATE_TIERS.find(
        ({ minDays, maxDays }) => days >= minDays && days <= maxDays
    ) || RENTAL_RATE_TIERS[0];
    const discountRate = Math.min(tier.discount, MAX_DURATION_DISCOUNT);
    const minimumDailyRate = baseDailyRate * (1 - MAX_DURATION_DISCOUNT);
    const dailyRate = roundCurrency(Math.max(
        minimumDailyRate,
        baseDailyRate * (1 - discountRate)
    ));
    const baseSubtotal = roundCurrency(baseDailyRate * days);
    const vehicleSubtotal = roundCurrency(dailyRate * days);
    const discountAmount = roundCurrency(baseSubtotal - vehicleSubtotal);
    const extrasTotal = roundCurrency(extrasDailyRate * days);

    return {
        days,
        baseDailyRate,
        dailyRate,
        discountRate,
        discountAmount,
        baseSubtotal,
        vehicleSubtotal,
        extrasDailyRate,
        extrasTotal,
        total: roundCurrency(vehicleSubtotal + extrasTotal)
    };
}

export function getPublicRateSummary(car) {
    const dailyRate = Math.max(0, Number(car?.precioDia) || 0);

    return {
        hourlyReference: roundCurrency(dailyRate / 8),
        dailyRate,
        weekly: getRentalQuote(car, 7),
        monthly: getRentalQuote(car, 30)
    };
}
