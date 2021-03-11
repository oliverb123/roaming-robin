

document.getElementById("file_upload").addEventListener("change", (event) => {
    const fileList = event.target.files;
    loadArchives(fileList);
});

var tweets = [];
var tweets_by_id = {};
var email = "email@example.com";

function loadArchives(fileList){
    if(fileList.length > 1){
        alert("Sorry, only one archive may be loaded at a time");
        return;
    }
    email = document.getElementById("email_input").value;
    for(let i = 0; i < fileList.length; i++){
        var r = new FileReader();
        r.addEventListener("load", e => {
            text = e.target.result;
            loadTweets(text);
            main();
        })
        r.readAsText(fileList[i]);
    }
}

function loadTweets(text){
    text = text.slice(text.indexOf("["));
    let data = JSON.parse(text);
    data.forEach((tweet) => {
        tweets.push(tweet["tweet"]);
        tweets_by_id[tweet["tweet"]["id"]] = tweet["tweet"];
    });
}

function suffix(day){
    if((4 <= day && day <= 20) || (24 <= day && day <= 30)){
        return "th";
    } else {
        return ["st", "nd", "rd"][day % 10 - 1];
    }
}

function groupByDate(tweets) {
    let byDate = {};
    for(i in tweets) {
        let t = tweets[i];
        let date = t["created_at"].split(" ").slice(1, 3).join(" ").toLowerCase();
        date += " " + t["created_at"].split(" ")[5];
        if(date in byDate) {
            byDate[date].push(t);
        } else {
            byDate[date] = [t, ];
        }
    }
    return byDate;
}

function do_replace(orig, entities){
    entities.sort((a, b) => parseInt(a["indices"][0]) - parseInt(b["indices"][0]));
    let res = "";
    let prev = 0;
    for(let i in entities){
        let e = entities[i];
        let start = parseInt(e["indices"][0]);
        let end = parseInt(e["indices"][1]);
        res += orig.slice(prev, start);
        res += e["render_func"](e);
        prev = end
    }
    res += orig.slice(prev, orig.length);
    return res;
}

function get_photos(tweet){
    if(!("media" in tweet["entities"])) return [];
    let photos = tweet["entities"]["media"].filter(x => x["type"] == "photo" && !(x["media_url_https"].includes("video")));
    for(p in photos){
        photos[p]["render_func"] = x => "";
    }
    return photos;
}

function render_images(tweet){
    let urls = get_photos(tweet).map(x => x["media_url_https"]);
    if(urls.length == 0) return "";
    let res = "";
    for(i in urls){
        let u = urls[i];
        res += "![image](" + u + ")";
    }
    return res;
}

function render_tweet_alias(tweet){
    return "[tweet-link](https://twitter.com/null/status/" + tweet["id"] + ")";
}

function render_mention(mention){
    return "[[@" + mention['screen_name'] + "]]";
}

function get_mentions(tweet){
    if(!("user_mentions" in tweet["entities"])) return [];
    let entities = tweet["entities"]["user_mentions"];
    for(i in entities){
        entities[i]["render_func"] = render_mention;
    }
    return entities;
}

function render_tweet(tweet){
    let render = {
        "create-email" : email,
        "create-time" : Date.now(),
        "uid" : tweet["id"]
    };
    tweet_text = tweet["full_text"].replaceAll("\n\n", "\n").replaceAll("\n", " | ").replaceAll("&gt;", ">").replaceAll("&lt;", "<");
    entities = get_mentions(tweet).concat(get_photos(tweet));
    let line = do_replace(tweet_text, entities) + " " + render_tweet_alias(tweet) + "" + render_images(tweet);
    render["string"] = line;
    return add_reply_ref(tweet, render);
}

function add_reply_ref(tweet, render){
    if(!("in_reply_to_status_id" in tweet)) return render;
    let reply_id = tweet["in_reply_to_status_id"];
    if(reply_id in tweets_by_id) {
        return render_known_in_reply(tweet, render);
    } else {
        return render_foreign_in_reply(tweet, render);
    }
}

function render_known_in_reply(tweet, render) {
    let replied_tweet = tweet["in_reply_to_status_id"];
    if("refs" in render) {
        render["refs"].push({"uid" : replied_tweet});
    } else {
        render["refs"] = [{"uid" : replied_tweet}, ];
    }
    if(":block/refs" in render) {
        render[":block/refs"].push({":block/uid" : replied_tweet});
    } else {
        render[":block/refs"] = [{":block/uid" : replied_tweet}, ];
    }
    render["string"] += "((" + replied_tweet + "))";
    return render;
}

// this is pretty weak as this, and images, should really be children, but it does the job for now
function render_foreign_in_reply(tweet, render) {
    render["string"] += "\n In reply to https://twitter.com/null/status/" + tweet["in_reply_to_status_id"];
    return render;
}

function dayToTitle(date) {
    let chunks = date.split(" ");
    let months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    let month = months.filter(x => x.toLowerCase().includes(chunks[0]))[0];
    let day = chunks[1] + suffix(parseInt(chunks[1]));
    return month + " " + day + ", " + chunks[2];
}

// pulled from https://stackoverflow.com/questions/3665115/how-to-create-a-file-in-memory-for-user-to-download-but-not-through-server
function download(filename, text) {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

function main() {
    let byDate = groupByDate(tweets);
    let pages = [];
    for(let day in byDate) {
        page = {
            "create-email" : email,
            "create-time" : Date.now(),
            "title" : dayToTitle(day),
            "children" : [
                {
                    "create-email" : email,
                    "create-time" : Date.now(),
                    "string" : "#tweets",
                    "children" : byDate[day].map(x => render_tweet(x))
                }
            ]
        }
        pages.push(page);
    }
    console.log(pages);
    download("data.json", JSON.stringify(pages));
}