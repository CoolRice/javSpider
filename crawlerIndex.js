var Crawler = require("crawler");
let mongoose = require('mongoose');
var _ = require('lodash');
var request = require('request');
let VideoModel = require('./model');

global.count = 0;
const baseUrl = 'https://www.javbus.com';

mongoose.connect('mongodb://localhost/jav');


var videoPageRe = new RegExp(baseUrl + "/[A-Z]+-[0-9]+");

var c = new Crawler({
    maxConnections : 10,
    // skipDuplicates: true,
    // This will be called for each crawled page
    callback : function (error, result, $) {
        // $ is Cheerio by default
        //a lean implementation of core jQuery designed specifically for the server
        $('a').each(function(index, a) {
            var toQueueUrl = $(a).attr('href');
            if(toQueueUrl && toQueueUrl.match(videoPageRe))
            c.queue(toQueueUrl);
        });
        const from = _.get(result, 'request.response.uri');
        if (from && from.match(videoPageRe)) {
          getVideoInfo($, from);
        }
    }
});

// Queue just one URL, with default callback
c.queue(baseUrl);

function getVideoInfo($, from) {
  console.log(from + '-----------------------------------------begin')
  let video = {};
  let genresDomIndex = 0;
  let starsDomIndex = 0;

  video.from = from;
  video.name = $('h3').text()
  $('.info').children().each((index, item) => {
    if($(item).text().indexOf(':') > 0) {
      const key = $(item).text().split(':')[0];
      const value = $(item).text().split(':')[1];
      if(key === '識別碼') {
        video.code = value;
      }
      if(key === '發行日期') {
        video.date = value;
      }
      if(key === '長度') {
        video.length = value;
      }
      if(key === '導演') {
        video.director = {
          name: value
        };
      }
      if(key === '製作商') {
        video.maker = {
          name: value
        };
      }
      if(key === '發行商') {
        video.publisher = {
          name: value
        };
      }
      if(key === '系列') {
        video.series = {
          name: value
        };
      }
      if(key === '類別') {
        genresDomIndex = index;
      }
      if(key === '演員') {
        starsDomIndex = index;
      }
    }
    if(genresDomIndex && index === genresDomIndex + 1) {
      let genres = [];
      $(item).children().each((index, genre) => {
        let href = $(genre).children().attr('href');
        genres.push({
          name: $(genre).text(),
          key: href.split('/')[href.split('/').length - 1],
        });
      });
      video.genres = genres;
    }
    if(starsDomIndex && index === starsDomIndex + 2) {
      let stars = [];
      $(item).children().each((index, star) => {
        let href = $(star).children().attr('href');
        stars.push({
          name: $(star).text().trim(),
          key: href.split('/')[href.split('/').length - 1],
        });
      });
      video.stars = stars;
    }

  })
  const allUrls = getAllHref($('.info').html())
  allUrls.forEach(url => {
    if(url.indexOf('director') > 0) {
      video.director.key = url.split('/')[url.split('/').length-1]
    }
    if(url.indexOf('studio') > 0) {
      video.maker.key = url.split('/')[url.split('/').length-1]
    }
    if(url.indexOf('label') > 0) {
      video.publisher.key = url.split('/')[url.split('/').length-1]
    }
    if(url.indexOf('series') > 0) {
      video.series.key = url.split('/')[url.split('/').length-1]
    }
  });
  // cover
  video.cover_url = $('.bigImage').children().attr('src')


  // preview
  const previews = [];
  $('#sample-waterfall').children().each((index, item) => {
    previews.push({
      big: $(item).attr('href'),
      small: $(item).children().children().attr('src')
    });
  });
  video.previews = previews;
  const callback = (video) => {
    console.log(video)
    global.count = global.count + 1;
    saveVideo(video);
    console.log(from + '-----------------------------------------end, this is the ' + global.count);
  }
  // magnet link
  getItemMagnet($, video, callback)

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

function getMetaInfo($) {
  let script = $('script', 'body').eq(2).html();
  let gid_r = /gid\s+=\s+(\d+)/g.exec(script);
  let gid = gid_r[1];
  let uc_r = /uc\s+=\s(\d+)/g.exec(script);
  let uc = uc_r[1];
  let img_r = /img\s+=\s+\'(\http.+\.jpg)/g.exec(script);
  let img = img_r[1];
  return {
    gid: gid,
    img: img,
    uc: uc,
    lang: 'zh'
  };
}

function getItemMagnet($, video, done) {
  const meta = getMetaInfo($);
  const url = baseUrl + '/ajax/uncledatoolsbyajax.php?gid=' + meta.gid + '&lang=' + meta.lang + '&img=' + meta.img + '&uc=' + meta.uc + '&floor=' + Math.floor(Math.random() * 1e3 + 1);

  request = request.defaults({
    headers: {
      'Referer': 'http://www.javbus.com',
      'Cookie': 'existmag=all'
    }
  });

  request.get(url,
    function(err, res, body) {
      if (err) {
        console.log(video.code + ': get mag error')
      }
      else {
        let $body = $.load(body);
        // 将磁链单独存入
        const magnet_links = [];
        $body('tr').each((index, row) => {
            magnet_links.push({
              name: $(row).children().eq(0).text().trim(),
              size: $(row).children().eq(1).text().trim(),
              share_time: $(row).children().eq(2).text().trim(),
              link: $(row).children().eq(0).children().attr('href')
            });
        })
        video.magnet_links = magnet_links;
      }
      done(video)
    });
}

function saveVideo(videoInfo) {
  VideoModel.findOne({code: videoInfo.code}, (error, video) => {
    if (error) {
      //console.log(error);
    }
    if(!video) {
      VideoModel.create(videoInfo, error => {
        if(error) {
          //console.log(error);
        }
        else {
          console.log('save' + videoInfo.code + ' ' + videoInfo.name)
        }
      });
    }
  });
}
