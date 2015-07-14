#!/usr/bin/env python
# -*- coding: utf-8 -*-

from torext.app import TorextApp
import settings
from torext.handlers import BaseHandler
import neapi


app = TorextApp(settings)

ne = neapi.NetEase()


@app.route('/')
class HomeHandler(BaseHandler):
    def get(self):
        self.render('index.html')


class APIHandler(BaseHandler):
    def write_data(self, data):
        self.write_json({'data': data})


@app.route('/api/songs')
class SongsHandler(APIHandler):
    def get(self):
        ids = self.get_arguments('ids[]')
        print 'ids', ids
        songs = ne.songs_detail(ids)
        print 'songs', [i['id'] for i in songs]
        self.write_data(songs)


if '__main__' == __name__:
    app.command_line_config()
    app.run()
