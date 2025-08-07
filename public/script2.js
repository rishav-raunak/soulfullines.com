
    let allPosts = []; // Server se aaye saare posts (yeh hamesha ek array rahega)
    let currentFilteredPosts = []; // Filter hone ke baad dikhne wale posts

    // --- Pagination State ---
    let currentPage = 1;
    let postsPerPage = 8; // Ek page par posts ki sankhya

    async function loadPosts() {
        try {
            const res = await fetch('/all-posts');
            const data = await res.json(); // Pehle poora object lein { posts: [...] }

            // --- YEH HAI SABSE BADA FIX ---
            // Check karein ki backend se data.posts mila hai aur woh ek array hai
            if (data && Array.isArray(data.posts)) {
                allPosts = data.posts; // Sirf posts ka array 'allPosts' mein daalein
                currentFilteredPosts = [...allPosts]; // Shuru mein, koi filter nahi
                changePage(1); // Pehla page dikhayein
            } else {
                // Agar backend se galat format aaya to
                console.error("Backend se data format galat hai. 'posts' array nahi mila.", data);
                throw new Error("Invalid data format from server.");
            }
            
        } catch (error) {
            console.error("Posts load karne mein error aaya:", error);
            document.getElementById('posts').innerHTML = "<p>Posts load nahi ho paye. Please try again later.</p>";
        }
    }

    function showPosts(data) {
        document.getElementById('posts').innerHTML = data.map(p => {
            // Ab 'findIndex' sahi se kaam karega kyunki 'allPosts' ek array hai
            const originalPostIndex = allPosts.findIndex(post => post.id === p.id);
            const shareableContent = p.type === 'text'
                ? p.content
                : `${window.location.origin}/uploads/${p.content}`;
            const encodedText = encodeURIComponent(shareableContent);

            return `
            <div class="post">
                ${p.type === 'text' ? `<p>${p.content.replace(/\r\n/g, '<br>')}</p>` : `<img src="/uploads/${p.content}" alt="${p.tag}">`}
                <div class="actions">
                    <div class="social-icons">
                        <a href="https://wa.me/?text=${encodedText}" target="_blank"><img class="icon" src="https://img.icons8.com/color/48/000000/whatsapp--v1.png" alt="Share on WhatsApp"/></a>
                        <a href="https://www.facebook.com/sharer/sharer.php?u=${encodedText}" target="_blank"><img class="icon" src="https://img.icons8.com/color/48/000000/facebook-new.png" alt="Share on Facebook"/></a>
                        <a href="https://twitter.com/intent/tweet?text=${encodedText}" target="_blank"><img class="icon" src="https://img.icons8.com/color/48/000000/twitter--v1.png" alt="Share on Twitter"/></a>
                    </div>
                    <button class="copy-btn" onclick="copyCardText(${originalPostIndex})">Copy</button>
                </div>
            </div>
            `;
        }).join('');
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
        currentPage = page;
        const startIndex = (currentPage - 1) * postsPerPage;
        const endIndex = startIndex + postsPerPage;
        const paginatedPosts = currentFilteredPosts.slice(startIndex, endIndex);
        showPosts(paginatedPosts);
        renderPagination(currentFilteredPosts.length);
        window.scrollTo(0, 0);
    }

    async function copyCardText(index) {
        // Ab 'allPosts[index]' bilkul sahi kaam karega
        if (index === -1) return; // Agar post na mile to kuch na karein
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
        if (type === 'all') {
            currentFilteredPosts = [...allPosts];
        } else {
            // Ab '.filter' sahi kaam karega
            currentFilteredPosts = allPosts.filter(p => p.type === type);
        }
        changePage(1);
    }

    function filterTag(tag) {
        if (tag === 'all') {
            currentFilteredPosts = [...allPosts];
        } else {
            // Ab '.filter' sahi kaam karega
            currentFilteredPosts = allPosts.filter(p => p.tag === tag);
        }
        changePage(1);
    }

    function toggleMenu() {
        const mobileFilters = document.getElementById('mobile-filters');
        if (mobileFilters.style.display === 'block') {
            mobileFilters.style.display = 'none';
        } else {
            mobileFilters.style.display = 'block';
        }
    }

    // Page load hote hi posts fetch karein
    loadPosts();
