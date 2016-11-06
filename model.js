let mongoose = require('mongoose');

var videoSchema = mongoose.Schema({
  title: String,
  video_id: String,
  video_date: String,
  length: String,
  director: String,
  director_id: String,
  maker: String,
  label: String,
  cast: [String],
  cast_id: [String],
  score: String,
  jacket_img: String,
  genres: [String],
  previewthumbs: [String],
  code: String
});
let VideoModel = mongoose.model('videos', videoSchema);

module.exports = VideoModel
