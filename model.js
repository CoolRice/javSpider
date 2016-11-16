let mongoose = require('mongoose');

var videoSchema = mongoose.Schema({
  save_time: Date,
  from: String,
  name: String,
  code: String,
  date: String,
  length: String,
  director: {name: String, key: String},
  maker: {name: String, key: String},
  publisher: {name: String, key: String},
  series: {name: String, key: String},
  genres: [{name: String, key: String}],
  stars: [{name: String, key: String}],
  score: String,
  cover_url: String,
  genres: [{name: String, key: String}],
  previews: [{big: String, small: String}],
  magnet_links: [{name: String, size: String, share_time: String, link: String}]
});
let VideoModel = mongoose.model('videos', videoSchema);

module.exports = VideoModel
