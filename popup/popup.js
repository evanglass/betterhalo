// Save the Halo API URL when the save button is clicked
let saveButton = document.getElementById('saveButton');

saveButton.addEventListener('click', () => {
    const haloUrl = document.getElementById('haloUrlInput').value.trim();
    const upcomingAssignmentCount = parseInt(document.getElementById('upcomingAssignmentCountInput').value, 10) || 5;

    // Save the URL to Chrome storage
    chrome.storage.sync.set({ haloUrl: haloUrl, upcomingAssignmentCount: upcomingAssignmentCount }, () => {
        // Send message to background to update any necessary data
        chrome.runtime.sendMessage({ action: 'settings_updated' });

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
            document.getElementById('haloUrlInput').value = data.haloUrl || 'https://halo.gcu.edu';
        }
    });
});