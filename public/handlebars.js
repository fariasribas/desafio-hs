async function getFingerprint(source = 'internal') {
	try {
		let url;
		// basta selecionar na source se quer interno ou externo pra obter o json, assim da pra fazer deploy e
		// ir alterando sem problemas

		if (source === 'internal') {
			// JSON dentro do projeto
			url = '/templates/template1.json';
		} else if (source === 'external') {
			// JSON vindo de site externo
			url = 'https://meu-site-externo.com/data.json';
		} else {
			throw new Error("Fonte inválida. Use 'internal' ou 'external'.");
		}

		const res = await fetch(url);
		if (!res.ok) throw new Error('Erro ao buscar JSON');

		return await res.json();
	} catch (e) {
		console.error('Erro no getFingerprint:', e);
		return null;
	}
}

async function renderPage() {
	const data = await getFingerprint('internal'); // ou "external"
	if (!data) return;

	const template = Handlebars.compile(document.body.innerHTML);
	document.body.innerHTML = template(data);
}

renderPage();
