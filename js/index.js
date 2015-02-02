/*
 * An audio spectrum AudioVisualizer built with HTML5 Audio API
 * Author:Wayou
 * License:feel free to use but keep refer pls!
 * Feb 15, 2014
 * For more infomation or support you can :
 * view the project page:https://github.com/Wayou/HTML5_Audio_AudioVisualizer/
 * view online demo:http://wayou.github.io/HTML5_Audio_AudioVisualizer/
 */

$(function() {
    var visualizer = window.visualizer = new AudioVisualizer($('#visualizer'));

    if (!visualizer.audio_context) {
        alert('Your browser does not support audio_context');
        return;
    }

    var dragzone = new Dragzone($('#dragzone'));
    dragzone.init(visualizer);
});


var Dragzone = function(el) {
    this.el = el;
};


Dragzone.prototype = {
    init: function(visualizer) {
        var dragzone = this.el,
            hint = dragzone.find('.hint'),
            cover = dragzone.find('.cover'),
            _this = this;

        var update_color = function(color) {
            dragzone.css('border-color', color);
            hint.css('color', color);
        };

        $(document).bind('drop dragover', function (e) {
            // Prevent the default browser drop action:
            e.preventDefault();
        });

        //listen the drag & drop
        dragzone.on('dragenter', function() {
            console.log('dragenter');
            cover.show();
            update_color('#378AC0');
        });

        cover.on({
            'dragover': function(e) {
                console.log('dragover');
            },
            'dragleave': function() {
                console.log('dragleave');
                update_color('#ccc');
                cover.hide();
            },
            'drop': function(e) {
                console.log('drop');
                e.preventDefault();
                e.originalEvent.dataTransfer.dropEffect = 'copy';

                // UI
                // update_color('#ccc');
                // hint.html('Processing');
                _this.hide();

                // Get the dropped file
                var file = e.originalEvent.dataTransfer.files[0];

                // Feed the file to visualizer
                visualizer.feed(file);
                visualizer.start();
            }
        });
    },
    hide: function() {
        this.el.hide();
    },
    show: function() {
        this.el.show();
    }
};


var AudioVisualizer = function($canvas) {
    this.$canvas = $canvas;

    this.file = null;
    this.file_name = null;

    this.audio_source = null;
    this.audio_context = this.get_audio_context();

    if (!this.audio_context) {
        console.error('Your browser does not support audio_context');
        return;
    }

    this.animation_id = null;

    // Playing status
    this.status = 0;
};


AudioVisualizer.prototype = {
    get_audio_context: function() {
        //fix browser vender for audio_context and requestAnimationFrame
        window.audio_context = window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.msAudioContext;
        window.requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.msRequestAnimationFrame;
        window.cancelAnimationFrame = window.cancelAnimationFrame || window.webkitCancelAnimationFrame || window.mozCancelAnimationFrame || window.msCancelAnimationFrame;
        try {
            return new window.audio_context();
        } catch (e) {
            console.error('new audio_context() error:', e);
            return null;
        }
    },

    feed: function(file) {
        this.file = file;
        if (this.audio_source !== null)
            this.audio_source.stop(0);
    },

    start: function() {
        //read and decode the file into audio array buffer
        var _this = this,
            file = this.file,
            fr = new FileReader();

        fr.onload = function(e) {
            var file_rv = e.target.result,
                audio_context = _this.audio_context;
            console.info('Decoding the audio');

            audio_context.decodeAudioData(
                file_rv,
                function(buffer) {
                    console.info('Decode succussfully, ready to process audio');
                    _this.process_audio(audio_context, buffer);
                },
                function(e) {
                    alert('!Fail to decode the file');
                    console.error('decodeAudioData error:', e);
                });
        };
        fr.onerror = function(e) {
            alert('!Fail to read the file');
            console.error('FileReader error:', e);
        };

        console.info('Starting read the file');
        fr.readAsArrayBuffer(file);
    },

    process_audio: function(audio_context, buffer) {
        var audio_source = audio_context.createBufferSource(),
            analyser = audio_context.createAnalyser(),
            _this = this;

        // Connect the source to the analyser
        audio_source.connect(analyser);

        // Connect the analyser to the destination(the speaker), or we won't hear the sound
        analyser.connect(audio_context.destination);

        // Then assign the buffer to the buffer source
        audio_source.buffer = buffer;

        // Stop the previous sound if any
        if (this.animation_id !== null)
            cancelAnimationFrame(this.animation_id);

        // Dispatch onended event
        audio_source.onended = function() {
            _this.status = 0;
        };

        // Play the source
        audio_source.start(0);
        console.info('Playing ' + this.file.name);

        // Set properties
        this.status = 1;
        this.audio_source = audio_source;

        // Start visualizing!
        this.draw_spectrum(analyser);
    },

    draw_spectrum: function(analyser) {
        var _this = this,
            canvas = this.$canvas[0],
            canvas_width = canvas.width,
            canvas_height = canvas.height - 2,
            meter_width = 10, //width of the meters in the spectrum
            meter_gap = 2, //gap between meters
            meter_num = 800 / (10 + 2), //count of the meters
            cap_height = 2,
            cap_style = '#fff',
            cap_y_pos_list = [], ////store the vertical position of hte caps for the preivous frame
            all_caps_reach_bottom,
            i;

        ctx = canvas.getContext('2d');
        gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, '#f00');  // Top: red
        gradient.addColorStop(0.5, '#ff0');  // Middle: yellow
        gradient.addColorStop(1, '#0f0');  // Bottom: green

        var draw_meter = function() {
            var stream = new Uint8Array(analyser.frequencyBinCount);
            // Fill the Uint8Array with data returned from getByteFrequencyData()
            analyser.getByteFrequencyData(stream);

            if (_this.status === 0) {
                // Fix when some sounds end the value still not back to zero
                for (i = stream.length - 1; i >= 0; i--) {
                    stream[i] = 0;
                }
                all_caps_reach_bottom = true;
                for (i = cap_y_pos_list.length - 1; i >= 0; i--) {
                    all_caps_reach_bottom = all_caps_reach_bottom && (cap_y_pos_list[i] === 0);
                }
                if (all_caps_reach_bottom) {
                    // Since the sound is stoped and animation finished,
                    // stop the requestAnimation to prevent potential memory leak, THIS IS VERY IMPORTANT!
                    cancelAnimationFrame(_this.animation_id);
                    return;
                }
            }
            // Sample limited data from the total stream
            var step = Math.round(stream.length / meter_num);
            ctx.clearRect(0, 0, canvas_width, canvas_height);

            for (i = 0; i < meter_num; i++) {
                var value = stream[i * step];
                if (cap_y_pos_list.length < Math.round(meter_num)) {
                    cap_y_pos_list.push(value);
                }
                ctx.fillStyle = cap_style;
                // Draw the cap, with transition effect
                if (value < cap_y_pos_list[i]) {
                    ctx.fillRect(i * 12, canvas_height - (--cap_y_pos_list[i]), meter_width, cap_height);
                } else {
                    ctx.fillRect(i * 12, canvas_height - value, meter_width, cap_height);
                    cap_y_pos_list[i] = value;
                }
                // Set the filllStyle to gradient for a better look
                ctx.fillStyle = gradient;
                ctx.fillRect(i * 12 /*meter_width+meter_gap*/ , canvas_height - value + cap_height, meter_width, canvas_height); //the meter
            }
            _this.animation_id = requestAnimationFrame(draw_meter);
        };
        this.animation_id = requestAnimationFrame(draw_meter);
    },
};
