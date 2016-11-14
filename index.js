let mongoose = require('mongoose');
let superagent = require("superagent");
let cheerio = require("cheerio");
let VideoModel = require('./model');

const baseUrl = 'http://javl10.com'

mongoose.connect('mongodb://localhost/jav');

function start(baseUrl) {
  enterUrl(baseUrl);
}

function analyzeHtml(url, html) {
  let isVideoPage = url.indexOf('/?v=') > 0;
  if(isVideoPage) {
    let videoInfo = getVideoInfo(html, url.split('/?v=')[1]);
    VideoModel.findOne({code: videoInfo.code}, (error, video) => {
      if (error) {
        //console.log(error);
      }
      if(!video) {
        console.log(videoInfo.video_id)
        VideoModel.create(videoInfo, error => {
          if(error) {
            //console.log(error);
          }
          else {
            console.log('save' + videoInfo.code + ' ' + videoInfo.title)
          }
        });
      }
    });

  }
  let refs = getAllHref(html);
  //console.log(refs)
  refs.forEach(item => {
    if(item.indexOf('/?v=') > 0 && item.indexOf('cn') === -1) {
      item = baseUrl + '/cn' + item.slice(1);
      enterUrl(item);
    }
    else if (item.indexOf('vl_') === 0 && item.indexOf('?') > 1) {
      item = baseUrl + '/cn/' + item;
      enterUrl(item);
    }
  });
}

//获取所有链接地址
let getAllHref = function(html){
    let reg = /<a.+?href=('|")?([^'"]+)('|")?(?:\s+|>)/gim;
    let arr = [];
    while(tem=reg.exec(html)){
        arr.push(tem[2]);
    }
    return arr;
}

function enterUrl(url) {
  console.log('enter url', url);
  let res = superagent.get(url).set("Cookie", "over18=18")
          // .timeout(3000)
          .end(function(err,res) {
            if(err) {
              console.log(err)
            }
            else{
              analyzeHtml(url, res.text);
            }
          });
}

// get detail video info
function getVideoInfo(html, code) {
  let videoObj = {}
  let $ = cheerio.load(html);

  let genres = [];                     // genres
  $('.genre').each((index, element) => {
      genres.push($(element).text().trim());
  });

  let previewthumbs = [];
  $('.previewthumbs').children().each((index, element) => {
      previewthumbs.push($(element).attr('src').replace('-','jp-'));
  });

  let cast = [];
  $('.cast').each((index,item) => {
    cast.push($(item).text().trim());
  })

  let cast_id = [];
  $('.cast').each((index,item) => {
    cast_id.push($(item).attr('id'));
  })

  videoObj = {
    title: $('.post-title').children().text().trim() || '',
    video_id: $('#video_id').children().children().children().last().text() || '',
    video_date: $('#video_date').children().children().children().last().text() || '',
    length: $('#video_length').children().children().children().last().text() || '',
    director: $('.director').children().text() || '',
    director_id: $('.director').attr('id') || '',
    maker: $('.maker').children().text() || '',
    label: $('.label').children().text() || '',
    cast: cast,
    cast_id: cast_id,
    score: $('.score').text() && $('.score').text().replace('(', '').replace(')', ''),
    jacket_img: $('#video_jacket_img').attr('src') || '',
    genres: genres,
    previewthumbs: previewthumbs,
    code: code
  }
  return videoObj;
}

start(baseUrl + '/cn/?v=javlilyc54');
