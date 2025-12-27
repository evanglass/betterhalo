// Save the Halo API URL when the save button is clicked
let saveButton = document.getElementById('saveButton');

saveButton.addEventListener('click', () => {
    const haloUrl = document.getElementById('haloUrlInput').value.trim();

    // Save the URL to Chrome storage
    chrome.storage.sync.set({ haloUrl: haloUrl }, () => {
        console.log('Halo URL saved:', haloUrl);

        saveButton.textContent = 'Saved!';
        saveButton.classList.add('success');
        setTimeout(() => {
            saveButton.textContent = 'Save';
            saveButton.classList.remove('success');
        }, 2000);
    });
});

// Load the saved URL when the popup is opened
document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.sync.get('haloUrl', (data) => {
        if (data.haloUrl) {
            document.getElementById('haloUrlInput').value = data.haloUrl;
        }
    });
});