// Dependencies
var express = require("express");
var bodyParser = require("body-parser");
var logger = require("morgan");
var mongoose = require("mongoose");
var path = require("path");

// //Models
var Note = require("./models/Note.js");
var Article = require("./models/Article.js");

// Scraping tools
var axios = require("axios");
var cheerio = require("cheerio");

// Port
var PORT = process.env.PORT || 3030

// Initialize Express
var app = express();

// Use morgan and body parser with our app
app.use(logger("dev"));
app.use(bodyParser.urlencoded({
    extended: false
}));

// Make public a static dir
app.use(express.static("public"));

// Set Handlebars.
var exphbs = require("express-handlebars");

app.engine("handlebars", exphbs({
    defaultLayout: "main",
    partials: path.join(__dirname, "/views/layouts/partials")
}));
app.set("view engine", "handlebars");

var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/mongoHeadlines"
mongoose.connect(MONGODB_URI);

////////////////////////ROUTES TO MAIN PAGE
app.get("/", function (req, res) {
    Article.find({ "saved": false }, function (error, data) {
        var hbsObject = {
            article: data
        };
        console.log(hbsObject);
        res.render("index", hbsObject);
    });
});

app.get("/saved", function (req, res) {
    Article.find({ "saved": true }).populate("notes").exec(function (error, articles) {
        var hbsObject = {
            article: articles
        };
        res.render("saved", hbsObject);
    });
});

console.log("\n***********************************\n" +
"Grabbing horoscopos\n" +
"\n***********************************\n");


app.get("/scrape", function (req, res) {


    // Make a request via axios to grab the HTML body from the site of your choice
    axios.get("https://www.refinery29.com/en-us/entertainment").then(function(response) {
    
      // Load the HTML into cheerio and save it to a variable
      // '$' becomes a shorthand for cheerio's selector commands, much like jQuery's '$'
      var $ = cheerio.load(response.data);
      $(".standard").each(function(i, element) {

      // An empty array to save the data that we'll scrape
      var results = {};
    
      // Select each element in the HTML body from which you want information.
      // NOTE: Cheerio selectors function similarly to jQuery's selectors,
      // but be sure to visit the package's npm page to see how it works
    
        results.title = $(element).find(".title").find("span").text();
        results. summary = $(element).find(".abstract").text();
        results.link = $(element).find("a").attr("href");
        results.img = $(element).find("img").attr("src");
        
            
      Article.create(results) 
      .then(function(data) {
          console.log(Article);
      })
      .catch(function(err) {
        return res.json(err)
    })
  })
  
    //   Log the results once you've looped through each of the elements found with cheerio
      res.send("Scrape Complete");

});
});



//////////ROUTE: CLEAR UNSAVED
app.get('/clear', function(req, res) {
    Article.remove({ saved: false}, function(err, doc) {
        if (err) {
            console.log(err);
        } else {
            console.log('removed');
        }

    });
    res.redirect('/');
});

////////////////////Gets the JSON
app.get("/articles", function (req, res) {
    // Grab every doc in the Articles array
    Article.find({}, function (error, data) {
        // Log any errors
        if (error) {
            console.log(error);
        }
        // Or send the data to the browser as a json object
        else {
            res.json(data);
        }
    });
});

///////////////////////ROUTE FOR AN ARTICLE
app.get("/articles/:id", function (req, res) {

    Article.findOne({ "_id": req.params.id })
        //Populate note
        .populate("note")
        /////////////////////?????ASK MATT ABOUT .then vs .exec????
        .exec(function (error, data) {
            // Log any errors
            if (error) {
                console.log(error);
            }
            else {
                res.json(data);
            }
        });
});


///////////////////////ROUTES TO SAVE
app.post("/articles/save/:id", function (req, res) {
    // Use the article id to find and update its saved boolean
   Article.findOneAndUpdate({ "_id": req.params.id }, { "saved": true })
        // Execute the above query
        .exec(function (err, data) {
            // Log any errors
            if (err) {
                console.log(err);
            }
            else {

                res.send(data);
            }
        });
});

//////////////////////////ROUTE TO DELETE
app.post("/articles/delete/:id", function (req, res) {
    //Anything not saved
    Article.findOneAndUpdate({ "_id": req.params.id }, { "saved": false, "notes": [] })

        .exec(function (err, data) {
            // Log any errors
            if (err) {
                console.log(err);
            }
            else {
                res.send(data);
            }
        });
});


////////////////////////ROUTE FOR COMMENT
app.post("/notes/save/:id", function (req, res) {
    // Create a new note and pass the req.body to the entry
    var newNote = new Note({
        body: req.body.text,
        article: req.params.id
    });
    console.log(req.body)
    // And save the new note the db
    newNote.save(function (error, note) {

        if (error) {
            console.log(error);
        }
        else {
            Article.findOneAndUpdate({ "_id": req.params.id }, { $push: { "notes": note } })
                /////???EXEC VS THEN???
                .exec(function (err) {

                    if (err) {
                        console.log(err);
                        res.send(err);
                    }
                    else {
                        res.send(note);
                    }
                });
        }
    });
});

/////////////////////////ROUTE TO DELTE A NOTE
app.delete("/notes/delete/:note_id/:article_id", function (req, res) {
    // Use the note id to find and delete it
   Note.findOneAndRemove({ "_id": req.params.note_id }, function (err) {
        // Log any errors
        if (err) {
            console.log(err);
            res.send(err);
        }
        else {
            Article.findOneAndUpdate({ "_id": req.params.article_id }, { $pull: { "notes": req.params.note_id } })
                // Execute the above query
                .exec(function (err) {
                    // Log any errors
                    if (err) {
                        console.log(err);
                        res.send(err);
                    }
                    else {
                        // Or send the note to the browser
                        res.send("Note Deleted");
                    }
                });
        }
    });
});

// Listen on port
app.listen(PORT, function () {
    console.log("App running on port " + PORT);
});







   