const target = document.body;
const observer = new MutationObserver(records => {
	const pattern = /https:\/\/github.com\/(.+)\/(.+)\/pull\/(\d+)\/files/;
	if (pattern.test(location.href)) {
		const prData = location.href.match(pattern);
		const owner = prData[1];
		const repo = prData[2];
		const prNumber = prData[3];
		chrome.storage.local.get(null, function (items) {
			const token = items.githubAccessToken;
			const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`;
			const request = new XMLHttpRequest();
			request.open("GET", url);
			request.setRequestHeader("Authorization", `token ${token}`);
			request.setRequestHeader("Accept", "application/vnd.github.v3.raw");
			request.onreadystatechange = function () {
				if (request.readyState != 4) {
					console.log("now pr info requeset sending...")
				} else if (request.status != 200) {
					console.error(`Github API fail! status=${request.status}`)
				} else {
					const prFilesInfo = request.responseText;
					const prFilesInfoJson = JSON.parse(prFilesInfo);
					const jupyterFileRegExp = /\.ipynb$/;
					const jupyterFilesInfoJson = prFilesInfoJson.filter(prFileInfoJson => jupyterFileRegExp.test(prFileInfoJson.filename));
					for(jupyterFileInfoJson of jupyterFilesInfoJson){
						const blobUrl = `https://api.github.com/repos/${owner}/${repo}/git/blobs/${jupyterFileInfoJson.sha}`;
						console.log(blobUrl);
						const rawFileRequest = new XMLHttpRequest();
						rawFileRequest.open("GET", blobUrl);
						rawFileRequest.setRequestHeader("Authorization", `token ${token}`);
						rawFileRequest.setRequestHeader("Accept", "application/vnd.github.v3.raw");
						rawFileRequest.onreadystatechange = function () {
							if(rawFileRequest.readyState !== 4){
								console.log("now raw file info requeset sending...")
							}else if(rawFileRequest.status != 200){
								console.error(`Github API fail! status=${request.status}`)
							}else{
								console.log(rawFileRequest.responseText);
							}
						}
						rawFileRequest.send(null);
					}
				}
			};
			request.send(null);
		});
	}
});
observer.observe(target, {
	attributes: true
});
