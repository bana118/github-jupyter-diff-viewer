const target = document.body;
const observer = new MutationObserver(records => {
	const filesBucket = document.getElementById("files_bucket");
	if(filesBucket != null){
		console.log(location.href);
	}
});
observer.observe(target, {
	attributes: true
});
