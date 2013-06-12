var request = require("request"),
	mysql = require("mysql"),
	fs = require("fs"),
	Throttle = require("./Throttle");

// Initlize the database
var db = mysql.createConnection({
	host: "localhost",
	user: "root",
	password: "root",
	database: "reddit_study"
});

db.connect();

/**
 * Here were going to explore the anatomy of a reddit post by
 * collecting a hundred posts from various subreddits. Since 
 * the reddit API has a request limit of 2 requests every second
 * throttling will have to be involved but the main plan is as 
 * follows.
 *
 * 1. Create the table for the posts
 * 2. Get 100 posts from every sub reddit
 * 3. Collect information on every post every 10 minutes.
 * 4. Leave running for 5 hours.
 *
 * Average Reddit Post Data:
 * 		{ "data" : { 
 * 			  "after" : null,
 *  		  "before" : null,
 * 		      "children" : [ { "data" : { "approved_by" : null,
 * 		                "author" : "iGoByManyNames",
 * 		                "author_flair_css_class" : null,
 * 		                "author_flair_text" : null,
 * 		                "banned_by" : null,
 * 		                "clicked" : false,
 * 		                "created" : 1371003758.0,
 * 		                "created_utc" : 1370974958.0,
 * 		                "distinguished" : null,
 * 		                "domain" : "i.imgur.com",
 * 		                "downs" : 10877,
 * 		                "edited" : false,
 * 		                "hidden" : false,
 * 		                "id" : "1g4ykr",
 * 		                "is_self" : false,
 * 		                "likes" : null,
 * 		                "link_flair_css_class" : null,
 * 		                "link_flair_text" : null,
 * 		                "media" : null,
 * 		                "media_embed" : {  },
 * 		                "name" : "t3_1g4ykr",
 * 		                "num_comments" : 321,
 * 		                "num_reports" : null,
 * 		                "over_18" : false,
 * 		                "permalink" : "/r/funny/comments/1g4ykr/sir_patrick_stewart_just_tweeted_this_picture/",
 * 		                "saved" : false,
 * 		                "score" : 4529,
 * 		                "selftext" : "",
 * 		                "selftext_html" : null,
 * 		                "subreddit" : "funny",
 * 		                "subreddit_id" : "t5_2qh33",
 * 		                "thumbnail" : "http://a.thumbs.redditmedia.com/OL_aU2dByrQl9eY6.jpg",
 * 		                "title" : "Sir Patrick Stewart just tweeted this picture",
 * 		                "ups" : 15406,
 * 		                "url" : "http://i.imgur.com/leWXamV.jpg"
 * 		              },
 * 		            "kind" : "t3"
 * 		          } ],
 * 		      "modhash" : "czex93qa2kd0182ea6e1e99f96aecf8438661ab2a7ffd22142"
 * 		    },
 * 		  "kind" : "Listing"
 * 		}
 */
var
 	//Dynamic table names so we never have to delete a study
	tableName = "study_" + Math.floor(Math.random() * 10000),
	//Reddit post fields
	fields = {
		title: "VARCHAR(500)",
		thumbnail: "VARCHAR(500)",
		permalink: "VARCHAR(500)",
		url: "VARCHAR(500)",
		domain: "VARCHAR(500)",
		media: "VARCHAR(500)", // Media provider url: data.media.oembed.provider_url
		author: "VARCHAR(100)",
		subreddit: "VARCHAR(50)",
		subreddit_id: "VARCHAR(14)",
		name: "VARCHAR(14)",
		id: "VARCHAR(14)",
		ups: "INT",
		downs: "INT",
		score: "INT",
		num_comments: "INT",
		created: "BIGINT",
		is_self: "BOOLEAN",
		over_18: "BOOLEAN"
	},
	//Compile the fields to a string
	fieldsString = (function() {
		var str = "";
		for(var field in fields) str += field + " " + fields[field] + ", ";
		return str.substr(0, str.length - 2);
	})(),

	tableQuery = "CREATE TABLE " + tableName + "(study_id INT NOT NULL AUTO_INCREMENT, " + fieldsString + ", PRIMARY KEY(study_id))";

//Create the table
db.query(tableQuery, function(err, rows) {
	if(err) console.log("Error creating table", err);
	else console.log("Table for study successfully created, '" + tableName + "'."), getSample(); //Start the sampling
});

//Helper functions
function queryReddit(url, callback) {
	console.log("Querying reddit: ", "http://reddit.com" + url);
	request("http://reddit.com" + url, function(err, response, body) {
		try {
			var data = JSON.parse(body);
		} catch(e) {
			log("Unable to parse JSON. " + body);
		}

		callback(data);
	})
}

function log(data) {
	fs.appendFile('error.log', "Error: " + data + "\n", function (err) {});
}

function getPost(id, callback) {
	queryReddit("/by_id/" + id + ".json", function(data) {
		callback(data.data.children[0].data);
	});
}

function getPostFromSubredditNew(subreddit, callback) {
	queryReddit("/r/" + subreddit + "/new.json", function(data) {
		//Let's get a small headstart and return the most commented post (it's usually a good indication of initial popularity)
		var posts = data.data.children,
			thePost;
		
		posts.forEach(function(post) {
			if(thePost && post.data.num_comments > thePost.num_comments) thePost = post.data;
			else thePost = post.data;
		});

		callback(thePost);
	})
}

function addPostToStudy(post, callback) {
	var values = [], _fields = [];
	for(var field in fields) if(post[field] !== undefined) { values.push(db.escape(post[field])); _fields.push(field); }


	db.query("INSERT INTO " + tableName + "(" + _fields.join(", ") + ") VALUES(" + values.join(", ") + ")", function() {
		if(callback) callback();
	});
}


var rate = 1000/2,
	sampleSize = 300,
	sample = [],
	repeat = 120,
	subreddits = ["funny", "pics", "wtf", "gaming", "aww"];

function getSample() {
	//First of all sort out the ratios
	var ratios = {}, ratioIteration = 0;
	subreddits.forEach(function(reddit) { ratios[reddit] = Math.floor(sampleSize/(subreddits.length)); });

	console.log("Subreddit sample ratios: ", ratios);
	console.log("Sample size:", sampleSize, "Records per sample item: ", repeat);

	Throttle(sampleSize, function(value, next, i) {
		if(ratios[subreddits[ratioIteration]]) {
			var sub = subreddits[ratioIteration];
			getPostFromSubredditNew(subreddits[ratioIteration], function(post) {
				console.log("Adding post to sample: ", i, sub + ((sub.length < 8) ? "\t\t" : "\t"), post.title.substr(0, 50) + ((post.title.length > 50) ? "..." : ""));
				sample.push(post);
				next();
			});

			//Decrement the count left for the subreddit and then bump to the next subreddit
			ratios[subreddits[ratioIteration]] = ratios[subreddits[ratioIteration]] - 1;
			ratioIteration = (ratioIteration >= subreddits.length - 1) ? 0 : ratioIteration + 1;
		}

	}, 30000, function() {
		startSampling();
	});
}

function startSampling() {
	console.log("Starting sampling the collected posts.");
	Throttle(sample, function(post, next, i, count, repeat) {
		getPost(post.name, function(post) {
			console.log("Updating post: ", repeat, post.name, post.score);
			addPostToStudy(post, function() {
				next();
			});
		})
	}, rate, repeat, function() {
		console.log("---------------------------------------\nSampling done.");
	})
}
