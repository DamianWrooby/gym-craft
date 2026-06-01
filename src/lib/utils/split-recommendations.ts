const HEADING_PATTERN = /^#{1,6}\s+.*recommend.*adjustments?.*$/im;

export interface SplitMarkdown {
    review: string;
    recommendations: string | null;
}

export function splitRecommendations(markdown: string): SplitMarkdown {
    if (!markdown) return { review: '', recommendations: null };

    const match = HEADING_PATTERN.exec(markdown);
    if (!match) return { review: markdown, recommendations: null };

    const splitIndex = match.index;
    const review = markdown.slice(0, splitIndex).trimEnd();
    const recommendations = markdown.slice(splitIndex).trimStart();
    return { review, recommendations };
}
