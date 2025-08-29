// Este script roda no browser e renderiza a página usando Handlebars
async function renderPage() {
	try {
		// Pega o template HTML
		const htmlRes = await fetch('/index.html');
		const html = await htmlRes.text();

		// Pega o JSON com dados
		const jsonRes = await fetch('/templates/template1.json');
		const data = await jsonRes.json();

		// Compila Handlebars e injeta na página
		const template = Handlebars.compile(html);
		const rendered = template(data);

		// Substitui o body inteiro
		document.open();
		document.write(rendered);
		document.close();

		/*
      // Alternativa fetch externo JSON (descomente se quiser usar)
      const externalRes = await fetch('https://meusite.com/templates/template1.json');
      const externalData = await externalRes.json();
      const renderedExternal = Handlebars.compile(html)(externalData);
      document.open();
      document.write(renderedExternal);
      document.close();
      */
	} catch (e) {
		console.error('Erro ao renderizar página:', e);
	}
}

// Chama a função ao carregar o script
renderPage();
