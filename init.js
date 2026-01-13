// Initial Load Logic
document.addEventListener('DOMContentLoaded', () => {
    // Force switch to default tab to ensure UI is in sync
    switchTab('texts');

    // Initialize icons
    if (window.feather) {
        feather.replace();
    }
});
