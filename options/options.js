// 設定画面で保存ボタンを押されたら
function save_options() {
    // 設定値を変数に格納
    let token = document.getElementById("github-access-token").value;

    // chromeアカウントと紐づくストレージに保存
    chrome.storage.local.set(
        {
            githubAccessToken: token
        },
        function () {
            // 保存できたら、画面にメッセージを表示(0.75秒だけ)
            let status = document.getElementById("status");
            status.textContent = "Options saved.";
            setTimeout(function () {
                status.textContent = "";
            }, 750);
        }
    );
}

// 設定画面で設定を表示する
function restore_options() {
    // デフォルト値は、ここで設定する
    chrome.storage.local.get(
        {
            githubAccessToken: ""
        },
        function (items) {
            document.getElementById("github-access-token").value = items.githubAccessToken;
        }
    );
}

document.addEventListener("DOMContentLoaded", restore_options);
document.getElementById("save").addEventListener("click", save_options);
