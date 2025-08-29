function getFingerprint() {
	return 'user-' + Math.floor(Math.random() * 100000);
}

async function renderPage() {
	try {
		const res = await fetch('/public/templates/template1.json');
		const data = await res.json();

		// Adiciona fingerprint
		data.userId = getFingerprint();

		// Processa o body inteiro com Handlebars
		const template = Handlebars.compile(document.body.innerHTML);
		document.body.innerHTML = template(data);
	} catch (e) {
		console.error('Erro ao renderizar JSON:', e);
	}
}

renderPage();
