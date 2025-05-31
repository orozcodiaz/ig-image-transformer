// PM2 config file
module.exports = {
    apps : [{
        name      : 'Remote Functions',
        script    : 'index.js',
        watch     : true,
        ignore_watch : [
            'uploads',
            '*.lock',
            '.git',
            'logs',
            '.crs-deployer.yml'
        ],
        watch_options: {
            followSymlinks: false
        }
    }]
};
