const target = document.body;
const prefix = "banatech-github-jupyter-diff-viewer";
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
					//console.log(prFilesInfoJson);
					const jupyterFileRegExp = /\.ipynb$/;
					const jupyterFilesInfoJson = prFilesInfoJson.filter(prFileInfoJson => jupyterFileRegExp.test(prFileInfoJson.filename));
					for (jupyterFileInfoJson of jupyterFilesInfoJson) {
						const blobUrl = `https://api.github.com/repos/${owner}/${repo}/git/blobs/${jupyterFileInfoJson.sha}`;
						const fileHeaderElement = document.querySelector(`[data-path="${jupyterFileInfoJson.filename}"]`);
						const diffHash = fileHeaderElement.dataset.anchor;
						const fileContainerElement = document.getElementById(diffHash);
						const diffPatch = jupyterFileInfoJson.patch;
						console.log(jupyterFileInfoJson);
						const rawFileRequest = new XMLHttpRequest();
						rawFileRequest.open("GET", blobUrl);
						rawFileRequest.setRequestHeader("Authorization", `token ${token}`);
						rawFileRequest.setRequestHeader("Accept", "application/vnd.github.v3.raw");
						rawFileRequest.onreadystatechange = function () {
							if (rawFileRequest.readyState !== 4) {
								console.log("now raw file info requeset sending...")
							} else if (rawFileRequest.status != 200) {
								console.error(`Github API fail! status=${request.status}`)
							} else if (diffPatch == null) {
								const divideEl = document.createElement("hr");
								fileContainerElement.appendChild(divideEl);

								const extensionDescriptionEl = document.createElement("p");
								extensionDescriptionEl.innerHTML = "Github Jupyter diff viewer extension";
								extensionDescriptionEl.style.backgroundColor = "#ffcc99";
								fileContainerElement.appendChild(extensionDescriptionEl);

								const diffLimitErrorElement = document.createElement("p");
								diffLimitErrorElement.innerHTML = "This diff may be too large to display on GitHub"
								diffLimitErrorElement.style.color = "red";
								fileContainerElement.appendChild(diffLimitErrorElement);
							} else {
								// console.log(rawFileRequest.responseText);
								const existDiffElement = document.getElementById(`${prefix}-${diffHash}`);
								if (existDiffElement != null) {
									existDiffElement.parentNode.removeChild(existDiffElement);
								}
								const diffElement = createDiffElement(diffHash, rawFileRequest.responseText, diffPatch);
								fileContainerElement.appendChild(diffElement);
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

function createDiffElement(hash, rawJupyterText, patch) {
	const diffInfo = parse(rawJupyterText, patch);
	const diffElement = document.createElement("div");
	diffElement.id = `${prefix}-${hash}`;

	const divideEl = document.createElement("hr");
	diffElement.appendChild(divideEl);

	const extensionDescriptionEl = document.createElement("p");
	extensionDescriptionEl.innerHTML = "Github Jupyter diff viewer extension";
	extensionDescriptionEl.style.backgroundColor = "#ffcc99";
	diffElement.appendChild(extensionDescriptionEl);

	const toggleButtonEl = document.createElement("button");
	toggleButtonEl.innerHTML = "hide";
	diffElement.appendChild(toggleButtonEl);

	const blobWrapperEl = document.createElement("div");
	blobWrapperEl.className = "data highlight js-blob-wrapper";
	blobWrapperEl.style = "overflow-x: auto";
	diffElement.appendChild(blobWrapperEl);

	toggleButtonEl.onclick = function () {
		if (toggleButtonEl.innerHTML == "hide") {
			toggleButtonEl.innerHTML = "show";
			blobWrapperEl.style.display = "none";
		} else if (toggleButtonEl.innerHTML == "show") {
			toggleButtonEl.innerHTML = "hide";
			blobWrapperEl.style.display = "block";
		}
	}


	const diffTableEl = document.createElement("table");
	diffTableEl.className = "diff-table js-diff-table tab-size";
	blobWrapperEl.appendChild(diffTableEl);

	const tbodyEl = document.createElement("tbody");
	diffTableEl.appendChild(tbodyEl);

	for (diffLines of diffInfo) {
		if (diffLines.length != 0) {
			const divideTrEl = document.createElement("tr");
			divideTrEl.className = "js-expandable-line";
			tbodyEl.appendChild(divideTrEl);

			const divideLeftTdEl = document.createElement("td");
			divideLeftTdEl.className = "blob-num blob-num-expandable";
			divideLeftTdEl.setAttribute("colSpan", "2");
			divideLeftTdEl.innerHTML = `${diffLines[0].type}`;
			divideTrEl.appendChild(divideLeftTdEl);

			const divideRightTdEl = document.createElement("td");
			divideRightTdEl.className = "blob-code blob-code-inner blob-code-hunk";
			if (diffLines[0].type == "code") {
				divideRightTdEl.innerHTML = `In[${diffLines[0].count}] @@ -${diffLines[0].prev_line},${diffLines[diffLines.length - 1].prev_line} +${diffLines[0].now_line},${diffLines[diffLines.length - 1].now_line} @@`;
			} else if (diffLines[0].type == "markdown") {
				divideRightTdEl.innerHTML = `@@ -${diffLines[0].prev_line},${diffLines[diffLines.length - 1].prev_line} +${diffLines[0].now_line},${diffLines[diffLines.length - 1].now_line} @@`;
			} else {
				console.error(`Jupyter diff create element error! jupyter source type must be code or markdown, but found ${diffLines[0].type}}`);
			}
			divideTrEl.appendChild(divideRightTdEl);
		}
		for (diffLine of diffLines) {
			const marker = diffLine.text.slice(0, 1);
			const code = diffLine.text.slice(1).replace(/^( *)"/, "$1").replace(/\\n",$|"$/, "").replace(/\\/g, "");

			const trEl = document.createElement("tr");
			tbodyEl.appendChild(trEl);

			if (marker == " ") {
				const tdNumLeftEl = document.createElement("td");
				tdNumLeftEl.className = "blob-num blob-num-context js-linkable-line-number"
				tdNumLeftEl.dataset.lineNumber = diffLine.prev_line;
				trEl.appendChild(tdNumLeftEl);

				const tdNumRightEl = document.createElement("td");
				tdNumRightEl.className = "blob-num blob-num-context js-linkable-line-number"
				tdNumRightEl.dataset.lineNumber = diffLine.now_line
				trEl.appendChild(tdNumRightEl);

				const tdCodeEl = document.createElement("td");
				tdCodeEl.className = "blob-code blob-code-context";
				trEl.appendChild(tdCodeEl);

				const codeWrapperSpanEl = document.createElement("span");
				codeWrapperSpanEl.className = "blob-code-inner blob-code-marker"
				codeWrapperSpanEl.dataset.codeMarker = marker;
				codeWrapperSpanEl.insertAdjacentText("beforeend", code);
				tdCodeEl.appendChild(codeWrapperSpanEl);
			} else if (marker == "-") {
				const tdNumLeftEl = document.createElement("td");
				tdNumLeftEl.className = "blob-num blob-num-deletion js-linkable-line-number"
				tdNumLeftEl.dataset.lineNumber = diffLine.prev_line;
				trEl.appendChild(tdNumLeftEl);

				const tdNumRightEl = document.createElement("td");
				tdNumRightEl.className = "blob-num blob-num-deletion empty-cell"
				trEl.appendChild(tdNumRightEl);

				const tdCodeEl = document.createElement("td");
				tdCodeEl.className = "blob-code blob-code-deletion";
				trEl.appendChild(tdCodeEl);

				const codeWrapperSpanEl = document.createElement("span");
				codeWrapperSpanEl.className = "blob-code-inner blob-code-marker"
				codeWrapperSpanEl.dataset.codeMarker = marker;
				codeWrapperSpanEl.insertAdjacentText("beforeend", code);
				tdCodeEl.appendChild(codeWrapperSpanEl);
			} else if (marker == "+") {
				const tdNumLeftEl = document.createElement("td");
				tdNumLeftEl.className = "blob-num blob-num-addition empty-cell"
				trEl.appendChild(tdNumLeftEl);

				const tdNumRightEl = document.createElement("td");
				tdNumRightEl.className = "blob-num blob-num-addition js-linkable-line-number"
				tdNumRightEl.dataset.lineNumber = diffLine.now_line
				trEl.appendChild(tdNumRightEl);

				const tdCodeEl = document.createElement("td");
				tdCodeEl.className = "blob-code blob-code-addition";
				trEl.appendChild(tdCodeEl);

				const codeWrapperSpanEl = document.createElement("span");
				codeWrapperSpanEl.className = "blob-code-inner blob-code-marker"
				codeWrapperSpanEl.dataset.codeMarker = marker;
				codeWrapperSpanEl.insertAdjacentText("beforeend", code);
				tdCodeEl.appendChild(codeWrapperSpanEl);
			} else {
				console.error(`Jupyter diff marker error! diff code marker must be space or + or -, but found ${marker}`);
			}
		}
	}

	// const tempTrEl = document.createElement("tr");
	// tbodyEl.appendChild(tempTrEl);

	// const tempTdEl1 = document.createElement("td");
	// tempTdEl1.className = "blob-num blob-num-deletion js-linkable-line-number"
	// tempTdEl1.dataset.lineNumber = "code"
	// tempTrEl.appendChild(tempTdEl1);

	// const tempTdEl2 = document.createElement("td");
	// tempTdEl2.className = "blob-num blob-num-deletion js-linkable-line-number"
	// tempTdEl2.dataset.lineNumber = "In[1]"
	// tempTrEl.appendChild(tempTdEl2);

	// const tempTdEl3 = document.createElement("td");
	// tempTdEl3.className = "blob-code blob-code-deletion";
	// tempTrEl.appendChild(tempTdEl3);

	// const tempSpanEl1 = document.createElement("span");
	// tempSpanEl1.className = "blob-code-inner blob-code-deletion";
	// tempSpanEl1.dataset.codeMarker = "-";
	// tempTdEl3.appendChild(tempSpanEl1);

	// const tempSpanEl2 = document.createElement("span");
	// tempSpanEl2.className = "pl-s1";
	// tempSpanEl2.innerHTML = "app";
	// tempSpanEl1.appendChild(tempSpanEl2);

	// const tempSpanEl3 = document.createElement("span");
	// tempSpanEl3.className = "pl-c1";
	// tempSpanEl3.innerHTML = " = ";
	// tempSpanEl1.appendChild(tempSpanEl3);

	// const tempSpanEl4 = document.createElement("span");
	// tempSpanEl4.className = "pl-v";
	// tempSpanEl4.innerHTML = "FastAPI";
	// tempSpanEl1.appendChild(tempSpanEl4);

	// tempSpanEl1.insertAdjacentText("beforeend", "()");


	return diffElement;
}

function parse(allJupyterText, patch) {
	const diffInfoList = [];
	const lineInfoRegs = /@@ [-+]\d+,\d+ [-+]\d+,\d+ @@\n/g;
	const lineInfoList = patch.match(lineInfoRegs);
	const diffList = patch.split(lineInfoRegs);
	diffList.splice(0, 1);
	const lineInfoSplitRegs = / |,/;
	const jupyterSourceList = extractSourceFromJupyter(allJupyterText);
	for (i = 0; i < diffList.length; i++) {
		const diff = diffList[i];
		const diffLines = diff.split("\n");
		const lineInfo = lineInfoList[i];
		const splitedLineInfo = lineInfo.split(lineInfoSplitRegs);
		const diffStartLine = Number(splitedLineInfo[3]);
		const diffEndLine = Number(splitedLineInfo[4]) + diffStartLine;
		for (j = 0; j < jupyterSourceList.length; j++) {
			const diffInfo = [];
			const jupyterSource = jupyterSourceList[j];
			let deletionCount = 0;
			if (diffStartLine >= jupyterSource.start && diffStartLine <= jupyterSource.end && diffEndLine >= jupyterSource.end) {
				let prevLineCount = diffStartLine - jupyterSource.start;
				let nowLineCount = diffStartLine - jupyterSource.start;
				for (k = 0; k < jupyterSource.end - diffStartLine + deletionCount; k++) {
					const marker = diffLines[k].slice(0, 1);
					if (marker == " ") {
						prevLineCount += 1;
						nowLineCount += 1;
					} else if (marker == "-") {
						prevLineCount += 1;
						deletionCount += 1;
					} else if (marker == "+") {
						nowLineCount += 1;
					} else {
						console.error(`Jupyter diff parse error! diff code marker must be space or + or -, but found ${marker}`);
					}
					if (jupyterSource.type == "code") {
						const lineJson = { "type": jupyterSource.type, "count": jupyterSource.count, "text": diffLines[k], "prev_line": prevLineCount, "now_line": nowLineCount };
						diffInfo.push(lineJson);
					} else if (jupyterSource.type == "markdown") {
						const lineJson = { "type": jupyterSource.type, "text": diffLines[k], "prev_line": prevLineCount, "now_line": nowLineCount };
						diffInfo.push(lineJson);
					} else {
						console.error(`Jupyter diff parse error! jupyter source type must be code or markdown, but found ${jupyterSource.type}`);
					}
				}
			} else if (diffStartLine <= jupyterSource.start && diffEndLine >= jupyterSource.end) {
				let prevLineCount = 0;
				let nowLineCount = 0;
				for (k = jupyterSource.start - diffStartLine; k < jupyterSource.end - diffStartLine + deletionCount; k++) {
					const marker = diffLines[k].slice(0, 1);
					if (marker == " ") {
						prevLineCount += 1;
						nowLineCount += 1;
					} else if (marker == "-") {
						prevLineCount += 1;
						deletionCount += 1;
					} else if (marker == "+") {
						nowLineCount += 1;
					} else {
						console.error(`Jupyter diff parse error! diff code marker must be space or + or -, but found ${marker}`);
					}
					if (jupyterSource.type == "code") {
						const lineJson = { "type": jupyterSource.type, "count": jupyterSource.count, "text": diffLines[k], "prev_line": prevLineCount, "now_line": nowLineCount };
						diffInfo.push(lineJson);
					} else if (jupyterSource.type == "markdown") {
						const lineJson = { "type": jupyterSource.type, "text": diffLines[k], "prev_line": prevLineCount, "now_line": nowLineCount };
						diffInfo.push(lineJson);
					} else {
						console.error(`Jupyter diff parse error! jupyter source type must be code or markdown, but found ${jupyterSource.type}`);
					}
				}
			} else if (diffStartLine <= jupyterSource.start && diffEndLine >= jupyterSource.start && diffEndLine <= jupyterSource.end) {
				let prevLineCount = 0;
				let nowLineCount = 0;
				for (k = jupyterSource.start - diffStartLine; k < diffEndLine - diffStartLine + deletionCount; k++) {
					const marker = diffLines[k].slice(0, 1);
					if (marker == " ") {
						prevLineCount += 1;
						nowLineCount += 1;
					} else if (marker == "-") {
						prevLineCount += 1;
						deletionCount += 1;
					} else if (marker == "+") {
						nowLineCount += 1;
					} else {
						console.error(`Jupyter diff parse error! diff code marker must be space or + or -, but found ${marker}`);
					}
					if (jupyterSource.type == "code") {
						const lineJson = { "type": jupyterSource.type, "count": jupyterSource.count, "text": diffLines[k], "prev_line": prevLineCount, "now_line": nowLineCount };
						diffInfo.push(lineJson);
					} else if (jupyterSource.type == "markdown") {
						const lineJson = { "type": jupyterSource.type, "text": diffLines[k], "prev_line": prevLineCount, "now_line": nowLineCount };
						diffInfo.push(lineJson);
					} else {
						console.error(`Jupyter diff parse error! jupyter source type must be code or markdown, but found ${jupyterSource.type}`);
					}
				}
			} else if (diffStartLine >= jupyterSource.start && diffEndLine <= jupyterSource.end) {
				let prevLineCount = diffStartLine - jupyterSource.start;
				let nowLineCount = diffStartLine - jupyterSource.start;
				for (k = 0; k < diffEndLine - diffStartLine + deletionCount; k++) {
					const marker = diffLines[k].slice(0, 1);
					if (marker == " ") {
						prevLineCount += 1;
						nowLineCount += 1;
					} else if (marker == "-") {
						prevLineCount += 1;
						deletionCount += 1;
					} else if (marker == "+") {
						nowLineCount += 1;
					} else {
						console.error(`Jupyter diff parse error! diff code marker must be space or + or -, but found ${marker}`);
					}
					if (jupyterSource.type == "code") {
						const lineJson = { "type": jupyterSource.type, "count": jupyterSource.count, "text": diffLines[k], "prev_line": prevLineCount, "now_line": nowLineCount };
						diffInfo.push(lineJson);
					} else if (jupyterSource.type == "markdown") {
						const lineJson = { "type": jupyterSource.type, "text": diffLines[k], "prev_line": prevLineCount, "now_line": nowLineCount };
						diffInfo.push(lineJson);
					} else {
						console.error(`Jupyter diff parse error! jupyter source type must be code or markdown, but found ${jupyterSource.type}`);
					}
				}
			}
			diffInfoList.push(diffInfo);
		}
	}
	console.log(diffInfoList);
	return diffInfoList;
}

function extractSourceFromJupyter(jupyter) {
	const sourceList = [];
	const typeRegs = /"cell_type": "(.+)",/;
	const sourceStartRegs = /"source": \[/;
	const sourceEndRegs = /^(?! *") *\]/;
	let extractState = "skip"; // skip, type, source
	let type = null;
	let lineNumber = 1;
	let sourceJson = {};
	let sourceLines = [];
	let execCount = 1;
	for (line of jupyter.split("\n")) {
		if (extractState == "source" && !sourceEndRegs.test(line)) {
			sourceLines.push(line);
		}
		if (typeRegs.test(line)) {
			if (extractState != "skip") {
				console.error(`line: ${lineNumber}, Jupyter extract error! extractState required: skip, but found ${extractState}`);
			}
			extractState = "type";
			type = typeRegs.exec(line)[1];
			sourceJson["type"] = type;
			if (type == "code") {
				sourceJson["count"] = execCount;
				execCount += 1;
			}
		} else if (sourceStartRegs.test(line)) {
			if (extractState != "type") {
				console.error(`line: ${lineNumber}, Jupyter extract error! extractState required: type, but found ${extractState}`);
			}
			sourceJson["start"] = lineNumber + 1;
			extractState = "source";
		} else if (sourceEndRegs.test(line)) {
			if (extractState == "source") {
				extractState = "skip";
				sourceJson["source"] = sourceLines;
				sourceJson["end"] = lineNumber;
				sourceList.push(sourceJson);
				sourceJson = {};
				sourceLines = [];
			}
		}
		lineNumber += 1;
	}
	console.log(sourceList);
	return sourceList;
}
