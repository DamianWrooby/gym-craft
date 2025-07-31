export const GET = async () => {
    const pages = [
		'',
		'app',
		'privacy-policy',
		'terms-of-use',
	];

    const base = 'https://gymcraft.damianwroblewski.com';

    const today = new Date();
    const lastmod = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
        today.getDate(),
    ).padStart(2, '0')}`;

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
    .map(
        (path) => `
  <url>
    <loc>${base}/${path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`,
    )
    .join('')}
</urlset>`;

    return new Response(body, {
        headers: {
            'Content-Type': 'application/xml',
        },
    });
};
