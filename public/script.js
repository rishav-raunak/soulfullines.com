
    let allPosts = [];
    let currentFilteredPosts = [];
    let currentPage = 1;
    let postsPerPage = 8;

    async function loadPosts() {
        try {
            const res = await fetch('/all-posts');
            const data = await res.json();
            if (data && Array.isArray(data.posts)) {
                allPosts = data.posts;
                currentFilteredPosts = [...allPosts];
                changePage(1);
            } else {
                console.error("Backend se data format galat hai.", data);
                throw new Error("Invalid data format from server.");
            }
        } catch (error) {
            console.error("Posts load karne mein error aaya:", error);
            document.getElementById('posts').innerHTML = "<p>Posts load nahi ho paye. Please try again later.</p>";
        }
    }

    function showPosts(data) {
        document.getElementById('posts').innerHTML = data.map(p => {
            const originalPostIndex = allPosts.findIndex(post => post.id === p.id);
            // HTML template for each post
            return `
                <div class="post">
                    ${p.type === 'text' ? `<p>${p.content.replace(/\r\n/g, '<br>')}</p>` : `<img src="/uploads/${p.content}" alt="${p.tag}">`}
                    <div class="actions">
                        <div class="social-icons">
                            <a class="share-btn whatsapp" href="#" data-content="${p.content}" data-type="${p.type}">
                                <img class="icon" src="https://img.icons8.com/color/48/000000/whatsapp--v1.png" alt="Share on WhatsApp"/>
                            </a>
                            <a class="share-btn facebook" href="#" data-content="${p.content}" data-type="${p.type}">
                                <img class="icon" src="https://img.icons8.com/color/48/000000/facebook-new.png" alt="Share on Facebook"/>
                            </a>
                            <a class="share-btn twitter" href="#" data-content="${p.content}" data-type="${p.type}">
                                <img class="icon" src="https://img.icons8.com/color/48/000000/twitter--v1.png" alt="Share on Twitter"/>
                            </a>
                        </div>
                        <button class="copy-btn" onclick="copyCardText(${originalPostIndex})">Copy</button>
                    </div>
                </div>
            `;
        }).join('');

        // *** YEH HAI SABSE ZAROORI STEP ***
        // Har baar posts dikhane ke baad, unke share buttons par functionality add karein
        addShareFunctionality();
    }

    function addShareFunctionality() {
    const shareButtons = document.querySelectorAll('.share-btn');
    
    shareButtons.forEach(button => {
        button.addEventListener('click', function(event) {
            event.preventDefault(); // Page reload hone se rokein

            // 1. Button se post ka content aur type nikalein
            const postContent = event.currentTarget.dataset.content;
            const postType = event.currentTarget.dataset.type;

            // --- YAHAN HAI ASLI FIX ---
            // 2. Share karne ke liye text aur URL taiyar karein
            let shareableText = '';
            
            if (postType === 'text') {
                // Agar text post hai, to usi ka content share karein
                // Agar text lamba hai to use kaat bhi sakte hain: .substring(0, 200) + '...'
                shareableText = postContent; 
            } else {
                // Agar image post hai, to ek custom message share karein
                shareableText = "Amrit Raj ki site par yeh awesome image dekho!";
            }
            
            const shareableUrl = window.location.href; // Main page ka link
            
            // 3. Text aur URL ko encode karein
            const encodedText = encodeURIComponent(shareableText);
            const encodedUrl = encodeURIComponent(shareableUrl);

            // 4. Final share URL banayein
            let finalShareUrl = '';

            if (event.currentTarget.classList.contains('whatsapp')) {
                finalShareUrl = `https://wa.me/?text=${encodedText}%20${encodedUrl}`;
            } else if (event.currentTarget.classList.contains('facebook')) {
                // Facebook hamesha URL se hi data uthata hai, text se nahi
                finalShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
            } else if (event.currentTarget.classList.contains('twitter')) {
                finalShareUrl = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
            }

            // 5. Share window kholein
            if (finalShareUrl) {
                window.open(finalShareUrl, '_blank');
            }
        });
    });
}

    function renderPagination(totalPosts) {
        const totalPages = Math.ceil(totalPosts / postsPerPage);
        const paginationContainer = document.getElementById('pagination-container');
        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }
        let buttonsHTML = `<button class="page-btn" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>`;
        for (let i = 1; i <= totalPages; i++) {
            buttonsHTML += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
        }
        buttonsHTML += `<button class="page-btn" onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>`;
        paginationContainer.innerHTML = buttonsHTML;
    }

    function changePage(page) {
        const totalPages = Math.ceil(currentFilteredPosts.length / postsPerPage);
        if(page < 1 || page > totalPages) return;
        currentPage = page;
        const startIndex = (currentPage - 1) * postsPerPage;
        const endIndex = startIndex + postsPerPage;
        const paginatedPosts = currentFilteredPosts.slice(startIndex, endIndex);
        showPosts(paginatedPosts);
        renderPagination(currentFilteredPosts.length);
        window.scrollTo(0, 0);
    }

    async function copyCardText(index) {
        if (index === -1) return;
        const post = allPosts[index];
        const textToCopy = post.type === 'text' ? post.content : `${window.location.origin}/uploads/${post.content}`;
        try {
            await navigator.clipboard.writeText(textToCopy);
            alert('Copied to clipboard!');
        } catch (err) {
            console.error('Copy karne mein fail ho gaye:', err);
            alert('Copy nahi ho saka.');
        }
    }

    function showAllPosts() {
        currentFilteredPosts = [...allPosts];
        changePage(1);
    }

    function filterPosts(type) {
        currentFilteredPosts = type === 'all' ? [...allPosts] : allPosts.filter(p => p.type === type);
        changePage(1);
    }

    function filterTag(tag) {
        currentFilteredPosts = tag === 'all' ? [...allPosts] : allPosts.filter(p => p.tag === tag);
        changePage(1);
    }

    function toggleMenu() {
        const mobileFilters = document.getElementById('mobile-filters');
        mobileFilters.style.display = mobileFilters.style.display === 'block' ? 'none' : 'block';
    }

    loadPosts();
