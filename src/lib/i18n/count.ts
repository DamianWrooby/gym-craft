// Counted nouns in the request's locale. Polish needs three forms (1 tydzień, 2 tygodnie,
// 5 tygodni), so each count picks its message by Intl.PluralRules instead of adding an "s".
import { m } from '$lib/paraglide/messages.js';
import { getLocale } from '$lib/paraglide/runtime.js';

type Forms = {
    one: (p: { n: number }) => string;
    few: (p: { n: number }) => string;
    many: (p: { n: number }) => string;
};

function counted(n: number, forms: Forms): string {
    const category = new Intl.PluralRules(getLocale()).select(n);
    const form = category === 'one' ? forms.one : category === 'few' ? forms.few : forms.many;
    return form({ n });
}

export const countWeeks = (n: number) =>
    counted(n, { one: m.count_weeks_one, few: m.count_weeks_few, many: m.count_weeks_many });

export const countRunDays = (n: number) =>
    counted(n, { one: m.count_run_days_one, few: m.count_run_days_few, many: m.count_run_days_many });
