const target = document.body;
const observer = new MutationObserver(records => {
	const pattern = /https:\/\/github.com\/(.+)\/(.+)\/pull\/(\d+)\/files/
	if (pattern.test(location.href)) {
		const prData = location.href.match(pattern);
		const owner = prData[1];
		const repo = prData[2];
		const prNumber = prData[3];
		chrome.storage.local.get(null, function (items) {
			const token = items.githubAccessToken;
			const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`;
			var request = new XMLHttpRequest();
			request.open('GET', url);
			request.setRequestHeader("Authorization", `token ${token}`);
			request.onreadystatechange = function () {
				if (request.readyState != 4) {
					console.log("now sending...")
				} else if (request.status != 200) {
					console.log(`fail! status=${request.status}`)
				} else {
					const result = request.responseText;
					console.log(result);
				}
			};
			request.send(null);
		});
	}
});
observer.observe(target, {
	attributes: true
});
