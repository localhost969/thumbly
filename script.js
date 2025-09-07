document.addEventListener('DOMContentLoaded', function () {
    const urlsTextarea = document.getElementById('urls');
    const downloadBtn = document.getElementById('downloadBtn');
    const clearBtn = document.getElementById('clearBtn');
    const previewContainer = document.getElementById('previewContainer');
    const statusDiv = document.getElementById('status');
    const statusIcon = document.getElementById('statusIcon');
    const statusTitle = document.getElementById('statusTitle');
    const statusMessage = document.getElementById('statusMessage');

    let isDownloading = false;


    function showStatus(type, title, message) {
        if (type === 'error') {
            statusDiv.classList.remove('hidden');
            statusTitle.textContent = title;
            statusMessage.textContent = message;
            statusDiv.className = 'bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-lg';
            statusIcon.innerHTML = '';
        } else {
            statusDiv.classList.add('hidden');
        }
    }


    function extractVideoId(url) {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
            /youtube\.com\/embed\/([^&\n?#]+)/,
            /youtube\.com\/v\/([^&\n?#]+)/
        ];

        for (let pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        return null;
    }


    function extractPlaylistId(url) {
        const match = url.match(/[?&]list=([^&\n?#]+)/);
        return match ? match[1] : null;
    }


    function getThumbnailUrl(videoId, quality = 'maxresdefault') {
        return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
    }


    function createPreviewElement(videoId, thumbnailUrl, originalUrl) {
        const div = document.createElement('div');
        div.className = 'bg-gray-50 rounded-lg p-3';

        const img = document.createElement('img');
        img.src = thumbnailUrl;
        img.alt = `Thumbnail for ${videoId}`;
        img.className = 'w-full h-48 object-cover rounded-md mb-2';
        img.dataset.videoId = videoId;
        img.dataset.originalUrl = originalUrl;

        const p = document.createElement('p');
        p.className = 'text-xs text-gray-600 truncate';
        p.textContent = videoId;

        const btn = document.createElement('button');
        btn.className = 'w-full bg-red-600 hover:bg-red-700 text-white text-sm py-1 px-3 rounded mt-2 transition duration-300';
        btn.textContent = 'Download';
        btn.onclick = function () {
            downloadImage(thumbnailUrl, `${videoId}.jpg`);
        };

        div.appendChild(img);
        div.appendChild(p);
        div.appendChild(btn);

        return div;
    }


    function downloadImage(url, filename) {
        fetch(url)
            .then(response => response.blob())
            .then(blob => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            })
            .catch(error => {
                console.error('Error downloading image:', error);
                showStatus('error', 'Download Failed', `Could not download ${filename}`);
            });
    }


    async function downloadAsZip(images) {
        try {

            const jszipScript = document.createElement('script');
            jszipScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            document.head.appendChild(jszipScript);

            await new Promise(resolve => {
                jszipScript.onload = resolve;
            });

            const JSZip = window.JSZip;
            const zip = new JSZip();

            for (let i = 0; i < images.length; i++) {
                const { url, filename } = images[i];
                try {
                    const response = await fetch(url);
                    const blob = await response.blob();
                    zip.file(filename, blob);
                } catch (error) {
                    console.error(`Error adding ${filename} to zip:`, error);
                }
            }

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const zipUrl = URL.createObjectURL(zipBlob);

            const link = document.createElement('a');
            link.href = zipUrl;

            const now = new Date();
            const timestamp = now.getFullYear() + '-' +
                String(now.getMonth() + 1).padStart(2, '0') + '-' +
                String(now.getDate()).padStart(2, '0') + '-' +
                String(now.getHours()).padStart(2, '0') + '-' +
                String(now.getMinutes()).padStart(2, '0') + '-' +
                String(now.getSeconds()).padStart(2, '0');
            link.download = `yt-thumbnails-${timestamp}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Error creating zip:', error);
            showStatus('error', 'Zip Creation Failed', 'Could not create zip file');
        }
    }


    async function processPlaylist(playlistId) {
        showStatus('error', 'Playlists Not Supported', 'Sorry, playlist downloads are not supported yet.');
        return [];
    }


    async function downloadThumbnails() {
        if (isDownloading) return;

        const urls = urlsTextarea.value.trim().split('\n').filter(url => url.trim().length > 0);

        if (urls.length === 0) {
            showStatus('error', 'No URL Found', 'Please enter at least one YouTube URL to download');
            return;
        }

        isDownloading = true;


        previewContainer.innerHTML = '';

        const thumbnails = [];
        const videoIds = new Set();

        for (const url of urls) {
            if (url.includes('list=')) {
                const playlistId = extractPlaylistId(url);
                if (playlistId) {
                    await processPlaylist(playlistId);
                }
            } else {
                const videoId = extractVideoId(url);
                if (videoId) {
                    videoIds.add(videoId);
                }
            }
        }

        if (videoIds.size === 0) {
            if (!urls.some(url => url.includes('list='))) {
                showStatus('error', 'No Valid URLs', 'Could not extract any valid video IDs from the provided URLs');
            }
            isDownloading = false;
            return;
        }


        function loadThumbnail(videoId) {
            return new Promise((resolve) => {
                const qualities = ['maxresdefault', 'sddefault', 'hqdefault', 'mqdefault', 'default'];
                let currentQualityIndex = 0;
                let thumbnailUrl = getThumbnailUrl(videoId, qualities[currentQualityIndex]);

                function tryLoadImage() {
                    const testImg = new Image();
                    testImg.src = thumbnailUrl;

                    testImg.onload = function () {

                        const previewElement = createPreviewElement(videoId, thumbnailUrl, '');
                        previewContainer.appendChild(previewElement);

                        document.getElementById('emptyState').style.display = 'none';
                        resolve({ url: thumbnailUrl, filename: `${videoId}.jpg` });
                    };

                    testImg.onerror = function () {
                        currentQualityIndex++;
                        if (currentQualityIndex < qualities.length) {

                            thumbnailUrl = getThumbnailUrl(videoId, qualities[currentQualityIndex]);
                            tryLoadImage();
                        } else {
                            thumbnailUrl = getThumbnailUrl(videoId, 'default');
                            const previewElement = createPreviewElement(videoId, thumbnailUrl, '');
                            previewContainer.appendChild(previewElement);
                            document.getElementById('emptyState').style.display = 'none';
                            resolve({ url: thumbnailUrl, filename: `${videoId}.jpg` });
                        }
                    };
                }

                tryLoadImage();
            });
        }

        const thumbnailPromises = Array.from(videoIds).map(videoId => loadThumbnail(videoId));
        const loadedThumbnails = await Promise.all(thumbnailPromises);
        thumbnails.push(...loadedThumbnails);

        if (thumbnails.length > 1) {
            await downloadAsZip(thumbnails);
        }

        isDownloading = false;
    }

    function clearAll() {
        urlsTextarea.value = '';
        previewContainer.innerHTML = '';
        statusDiv.classList.add('hidden');

        const downloadAllBtn = document.querySelector('.bg-green-600');
        if (downloadAllBtn) {
            downloadAllBtn.remove();
        }
    }

    downloadBtn.addEventListener('click', downloadThumbnails);
    clearBtn.addEventListener('click', clearAll);
    document.getElementById('mobileMenuBtn').addEventListener('click', function () {
        const menu = document.getElementById('mobileMenu');
        menu.classList.toggle('hidden');
    });
});

