var Crawler = require("crawler");
let mongoose = require('mongoose');
var _ = require('lodash');
var request = require('sync-request');
let VideoModel = require('./model');

global.count = 0;
global.oldUrl = [];
const baseUrl = 'https://www.javbus.com';

let conn = mongoose.connect('mongodb://localhost/jav1');

var params = process.argv.splice(2);

var videoPageRe = new RegExp(baseUrl + "/[A-Z]+-[0-9]+");

var c = new Crawler({
    maxConnections : 10,
    skipDuplicates: true,
    headers: {
      'Referer': 'http://www.javbus.com',
      'Cookie': 'existmag=all'
    },
    // This will be called for each crawled page
    callback : function (error, result, $) {
        // $ is Cheerio by default
        //a lean implementation of core jQuery designed specifically for the server
        // $('a').each(function(index, a) {
        //     var toQueueUrl = $(a).attr('href');
        //     if(toQueueUrl && toQueueUrl.match(videoPageRe)){
        //       // c.queue(toQueueUrl);
        //     }
        //
        // });
        // console.log($('#waterfall').html())
        let urls = getAllHref($('#waterfall').html())
        .concat(getAllHref($('.pagination').html()).map(item => `${baseUrl}${item}`))
        .concat(getAllHref($('.info').html()));
        urls = _.uniq(urls);
        urls.forEach(url => {
          if(global.oldUrl.indexOf(url) === -1
            && url.indexOf('genre') === -1
            && url.indexOf('label') === -1
            && url.indexOf('series') === -1) {
            // console.log(global.oldUrl.indexOf('url'))
            // console.log(global.oldUrl)
            c.queue(url)
            // console.log('queue ' + url)
            global.oldUrl.push(url)
          }
        });
        const from = _.get(result, 'request.response.uri');
        if (from && from.match(videoPageRe)) {
          getVideoInfo($, from);
        }
        // console.log($('#waterfall').html())

    }
});

function start(baseUrl) {
  VideoModel.count({}, (err, res) => {
    console.log(`total count ${res}.`)
    global.count = res;
      if(res && res > 0) {
        VideoModel.findOne().sort({ _id: -1}).limit(1).exec((err, res) => {
          console.log(`latest saved movie is ${res.code}`);
          c.queue(baseUrl + '/' + res.code.trim());
        })
      }
      else {
        c.queue(baseUrl)
      }
  })
}
start(baseUrl)
// Queue just one URL, with default callback
// c.queue(baseUrl + '/ipz-100');

function getVideoInfo($, from) {
  console.log((new Date())+from + '-----------------------------------------begin')
  let video = {};
  let genresDomIndex = 0;
  let starsDomIndex = 0;
  try{
    video.from = from.trim();
    video.name = $('h3').text().trim()
    $('.info').children().each((index, item) => {
      if($(item).text().indexOf(':') > 0) {
        const key = $(item).text().split(':')[0];
        const value = $(item).text().split(':')[1];
        if(key === '識別碼') {
          video.code = value.trim()
        }
        if(key === '發行日期') {
          video.date = value.trim()
        }
        if(key === '長度') {
          video.length = value.trim()
        }
        if(key === '導演') {
          video.director = {
            name: value.trim()
          };
        }
        if(key === '製作商') {
          video.maker = {
            name: value.trim()
          };
        }
        if(key === '發行商') {
          video.publisher = {
            name: value.trim()
          };
        }
        if(key === '系列') {
          video.series = {
            name: value.trim()
          };
        }
        if(key === '類別') {
          genresDomIndex = index
        }
        if(key === '演員') {
          starsDomIndex = index
        }
      }
      if(genresDomIndex && index === genresDomIndex + 1) {
        let genres = [];
        $(item).children().each((index, genre) => {
          let href = $(genre).children().attr('href');
          genres.push({
            name: $(genre).text().trim(),
            key: href.split('/')[href.split('/').length - 1].trim(),
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
            key: href.split('/')[href.split('/').length - 1].trim(),
          });
        });
        video.stars = stars;
      }

    })
    const allUrls = getAllHref($('.info').html())
    // allUrls.forEach(url => c.queue(url));
    allUrls.forEach(url => {
      if(url.indexOf('director') > 0) {
        video.director.key = url.split('/')[url.split('/').length-1].trim();
      }
      if(url.indexOf('studio') > 0) {
        video.maker.key = url.split('/')[url.split('/').length-1].trim();
      }
      if(url.indexOf('label') > 0) {
        video.publisher.key = url.split('/')[url.split('/').length-1].trim();
      }
      if(url.indexOf('series') > 0) {
        video.series.key = url.split('/')[url.split('/').length-1].trim();
      }
    });
    // cover
    video.cover_url = $('.bigImage').children().attr('src');


    // preview
    const previews = [];
    $('#sample-waterfall').children().each((index, item) => {
      previews.push({
        big: $(item).attr('href'),
        small: $(item).children().children().attr('src')
      });
    });
    video.previews = previews;
  }
  catch(e) {
    console.log(e)
  }


  const callback = (video) => {
    saveVideo(video);
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
  let gid = (gid_r && gid_r[1]) || '';
  let uc_r = /uc\s+=\s(\d+)/g.exec(script);
  let uc = (uc_r && uc_r[1]) || '';
  let img_r = /img\s+=\s+\'(\http.+\.jpg)/g.exec(script);
  let img = (img_r && img_r[1]) || '';
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

    var res = request('GET', url, {
      'headers': {
        'Referer': 'http://www.javbus.com',
        'Cookie': 'existmag=all'
      }
    });
    let body = '';
    try {
      body = (res && res.getBody()) || '';
    }
    catch(e) {
      body = '';
    }

    if(body.indexOf('暫時沒有磁力連結') === -1) {
      try{
        let $body = $.load(res.getBody());
        // 将磁链单独存入
        const magnet_links = [];
        $body('tr').each((index, row) => {
          if ($(row).children().eq(0).children().attr('href')) {
            magnet_links.push({
              name: $(row).children().eq(0).text(),
              size: $(row).children().eq(1).text(),
              share_time: $(row).children().eq(2).text(),
              link: $(row).children().eq(0).children().attr('href')
            });
          }
        })
        video.magnet_links = magnet_links;
      }
      catch(e) {
        console.log(video.code)
        console.log(e)
        console.log(body.toString())
      }
    }

  done(video)
}

function saveVideo(videoInfo) {
  videoInfo.save_time = new Date();
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
          global.count = global.count + 1;
          console.log((new Date())+videoInfo.from + '-----------------------------------------end, this is the ' + global.count);
        }
      });
    }
    else {
      console.log((new Date())+videoInfo.from + '-----------------------------------------pass')
    }
  });
}
