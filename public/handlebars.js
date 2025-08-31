function getFingerprint() {}

async function renderPage() {
	try {
		const res = await fetch('/templates/template1.json');
		const data = await res.json();
		const template = Handlebars.compile(document.body.innerHTML);
		document.body.innerHTML = template(data);
	} catch (e) {
		console.error('Erro ao renderizar JSON:', e);
	}
}

renderPage();
