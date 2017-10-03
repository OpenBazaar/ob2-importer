/*!
 * Photon's Gruntfile
 * Copyright 2015 Connor Sears
 * Licensed under MIT (https://github.com/connors/photon/blob/master/LICENSE)
 */

module.exports = function(grunt) {
  'use strict';

  // Force use of Unix newlines
  grunt.util.linefeed = '\n';

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    // Metadata.
    meta: {
        distPath:       'dist/',
        docsAssetsPath: 'docs/assets/',
        docsDistPath:   'docs/dist/',
        docsPath:       'docs/',
        srcPath:        'sass/',
    },

    banner: '/*!\n' +
            ' * =====================================================\n' +
            ' * Photon v<%= pkg.version %>\n' +
            ' * Copyright <%= grunt.template.today("yyyy") %> <%= pkg.author %>\n' +
            ' * Licensed under <%= pkg.license %> (https://github.com/connors/proton/blob/master/LICENSE)\n' +
            ' *\n' +
            ' * v<%= pkg.version %> designed by @connors.\n' +
            ' * =====================================================\n' +
            ' */\n',

    clean: {
      dist: ['<%= meta.distPath %>/css', '<%= meta.docsDistPath %>/css']
    },

    sass: {
      options: {
        sourcemap: 'none',
        style: 'expanded',
        unixNewlines: true
      },
      core: {
        src: 'sass/photon.scss',
        dest: '<%= meta.distPath %>css/<%= pkg.name %>.css'
      },
      docs: {
        src: 'sass/docs.scss',
        dest: '<%= meta.docsAssetsPath %>css/docs.css'
      }
		},

    usebanner: {
      dist: {
        options: {
          position: 'top',
          banner: '<%= banner %>'
        },
        files: {
          src: [
            '<%= meta.distPath %>css/*.css'
          ]
        }
      }
    },

    copy: {
      fonts: {
        expand: true,
        src: 'fonts/*',
        dest: '<%= meta.distPath %>'
      },
      docs: {
        expand: true,
        cwd: '<%= meta.distPath %>',
        src: [
          '**/*'
        ],
        dest: '<%= meta.docsDistPath %>'
      }
    },

    cssmin: {
      options: {
        keepSpecialComments: '*' // keep all important comments
      },
      photon: {
        src: '<%= meta.distPath %>css/<%= pkg.name %>.css',
        dest: '<%= meta.distPath %>css/<%= pkg.name %>.min.css'
      },
      docs: {
        src: [
          '<%= meta.docsAssetsPath %>css/docs.css',
          '<%= meta.docsAssetsPath %>css/pygments-manni.css',
          '<%= meta.docsAssetsPath %>css/normalize.css'
        ],
        dest: '<%= meta.docsAssetsPath %>css/docs.min.css'
      }
    },

    watch: {
      options: {
        hostname: 'localhost',
        livereload: true,
        port: 8000
      },
      css: {
        files: '<%= meta.srcPath %>**/*.scss',
        tasks: ['dist-css', 'copy']
      },
      html: {
        files: '<%= meta.docsPath %>**',
        tasks: ['jekyll']
      }
    },

    jekyll: {
      options: {
        config: '_config.yml'
      },
      docs: {},
      github: {
        options: {
          raw: 'github: true'
        }
      }
    },

    connect: {
      site: {
        options: {
          base: '_site/',
          hostname: 'localhost',
          livereload: true,
          open: true,
          port: 8000
        }
      }
    },
    'electron-installer-debian': {
      options: {
        productName: 'OpenBazaar 2 Importer',
        name: 'openbazaar2importer',
        arch: 'amd64',
        version: '1.0.0',
        bin: 'openbazaar2importer',
        maintainer: 'OpenBazaar <project@openbazaar.org>',
        rename(dest) {
          return `${dest}<%= name %>_<%= version %>_<%= arch %>.deb`;
        },
        productDescription: 'Import tool for OpenBazaar 2',
        lintianOverrides: [
          'changelog-file-missing-in-native-package',
          'executable-not-elf-or-script',
          'extra-license-file',
        ],
        icon: 'imgs/icon.png',
        categories: ['Utility'],
        priority: 'optional',
      },
      'app-with-asar': {
        src: 'temp-linux64/openbazaar2importer-linux-x64/',
        dest: 'build-linux64/',
        rename(dest) {
          return path.join(dest, '<%= name %>_<%= arch %>.deb');
        },
      },
    },
    'create-windows-installer': {
      x32: {
        appDirectory: grunt.option('appdir'),
        outputDirectory: grunt.option('outdir'),
        name: 'OpenBazaar2Importer',
        productName: 'OpenBazaar2Importer',
        authors: 'OpenBazaar',
        owners: 'OpenBazaar',        
        exe: 'OpenBazaar2Importer.exe',
        description: 'OpenBazaar 2 Import Tool',
        version: grunt.option('obversion') || '',
        title: 'OpenBazaar2 Importer',
        iconUrl: 'https://www.openbazaar.org/wp-content/uploads/2017/07/windows-icon.ico',
        setupIcon: 'imgs/windows-icon.ico',
        skipUpdateIcon: true,
        loadingGif: 'imgs/windows-loading.gif',
        noMsi: true,
      },
    },
  });


  // Load the plugins
  require('load-grunt-tasks')(grunt, { scope: 'devDependencies' });
  require('time-grunt')(grunt);

  // Tasks
  grunt.registerTask('dist-css', ['sass', 'usebanner', 'cssmin']);
  grunt.registerTask('dist', ['clean', 'dist-css', 'copy']);
  grunt.registerTask('server', ['dist', 'jekyll:docs', 'connect', 'watch']);
  grunt.loadNpmTasks('grunt-electron-installer-debian');
  grunt.loadNpmTasks('grunt-electron-installer');
  grunt.registerTask('default', ['dist','electron-installer-debian']);
};
