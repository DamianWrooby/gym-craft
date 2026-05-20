export type AcwrStatus = 'undertraining' | 'optimal' | 'overreach' | 'high-risk';

export interface AcwrInterpretation {
    status: AcwrStatus;
    narrative: string;
}

export function interpretAcwr(acwr: number): AcwrInterpretation {
    if (acwr === 0) {
        return {
            status: 'undertraining',
            narrative: 'No chronic load has been built yet — keep adding consistent volume to establish a baseline.',
        };
    }
    if (acwr < 0.8) {
        return {
            status: 'undertraining',
            narrative:
                'Current load is well below the 4-week baseline — detraining risk if this persists. A small step-up is safe.',
        };
    }
    if (acwr <= 1.3) {
        return {
            status: 'optimal',
            narrative: 'Load is in the sweet spot for adaptation — current volume can be sustained.',
        };
    }
    if (acwr <= 1.5) {
        return {
            status: 'overreach',
            narrative: 'Load is above the productive range — short-term overreach is acceptable but plan recovery.',
        };
    }
    return {
        status: 'high-risk',
        narrative: 'Load has spiked sharply versus the 4-week baseline — elevated injury and illness risk.',
    };
}

export function interpretMonotony(monotony: number): { isHigh: boolean; narrative: string } {
    if (!isFinite(monotony) || monotony >= 2.5) {
        return {
            isHigh: true,
            narrative:
                'Training is highly monotonous — sessions are too uniform in intensity, which limits adaptation. Add variation between easy and hard days.',
        };
    }
    if (monotony >= 2.0) {
        return {
            isHigh: true,
            narrative: 'Monotony is elevated — consider greater intensity variation across the week.',
        };
    }
    return {
        isHigh: false,
        narrative: 'Intensity distribution across the week is healthy.',
    };
}
