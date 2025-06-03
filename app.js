// app.js
import { supabase, auth, storage, db } from './supabaseClient.js';

// --- Funções auxiliares (global para onclick no HTML) ---
window.openModal = function(title, imageSrc) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-image').src = imageSrc;
    document.getElementById('modal').style.display = 'flex';
};

window.closeModal = function() {
    document.getElementById('modal').style.display = 'none';
};

window.applyFilters = function() {
    const type = document.getElementById('type').value;
    const minPrice = parseFloat(document.getElementById('min-price').value) || 0;
    const maxPrice = parseFloat(document.getElementById('max-price').value) || Infinity;
    const bedrooms = document.getElementById('bedrooms').value;
    const status = document.getElementById('status').value;
    const properties = document.querySelectorAll('.property-grid .property-card');

    properties.forEach(property => {
        const propType = property.getAttribute('data-type');
        const price = parseFloat(property.getAttribute('data-price'));
        const propBedrooms = property.getAttribute('data-bedrooms');
        const propStatus = property.getAttribute('data-status');

        const matchesType = !type || propType === type;
        const matchesPrice = price >= minPrice && price <= maxPrice;
        const matchesBedrooms = !bedrooms || (bedrooms === '4+' ? parseInt(propBedrooms) >= 4 : propBedrooms === bedrooms);
        const matchesStatus = !status || propStatus === status;

        property.style.display = matchesType && matchesPrice && matchesBedrooms && matchesStatus ? 'block' : 'none';
    });
};

window.submitForm = function() {
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const message = document.getElementById('message').value;

    if (name && email && message) {
        alert(`Obrigado, ${name}! Sua mensagem foi enviada com sucesso. Entraremos em contato em breve.`);
        document.getElementById('contact-form').reset();
    } else {
        alert('Por favor, preencha todos os campos antes de enviar.');
    }
};


// --- FUNÇÕES DE INTEGRAÇÃO SUPABASE ---

// Carrega e exibe os imóveis na página principal (index.html)
export async function loadProperties() {
    const propertyGrid = document.getElementById('property-grid');
    if (!propertyGrid) { // Garante que esta função só rode se a div existe
        console.warn('Div #property-grid não encontrada. loadProperties não será executada nesta página.');
        return;
    }
    propertyGrid.innerHTML = '<p>Carregando imóveis...</p>';

    const { data: imoveis, error: imovelError } = await db
        .from('imoveis')
        .select(`
            *,
            fotos_imoveis (url_foto)
        `);

    if (imovelError) {
        console.error('Erro ao buscar imóveis:', imovelError.message);
        propertyGrid.innerHTML = '<p>Não foi possível carregar os imóveis. Tente novamente mais tarde.</p>';
        return;
    }

    propertyGrid.innerHTML = '';

    if (imoveis.length === 0) {
        propertyGrid.innerHTML = '<p>Nenhum imóvel encontrado no momento.</p>';
        return;
    }

    imoveis.forEach(imovel => {
        const defaultImageUrl = imovel.fotos_imoveis && imovel.fotos_imoveis.length > 0
            ? imovel.fotos_imoveis[0].url_foto
            : 'https://via.placeholder.com/500x200?text=Sem+Foto';

        const card = document.createElement('div');
        card.className = 'property-card';
        card.setAttribute('data-type', imovel.tipo_imovel || '');
        card.setAttribute('data-price', imovel.preco || 0);
        card.setAttribute('data-bedrooms', imovel.num_quartos || 0);
        card.setAttribute('data-status', imovel.status_imovel || 'Pronto');

        card.innerHTML = `
            <img src="${defaultImageUrl}" alt="${imovel.titulo || 'Imóvel'}">
            <div class="property-info">
                <h3>${imovel.titulo}</h3>
                <p>${imovel.endereco || ''}, Piedade, SP</p>
                <p>${imovel.num_quartos || 0} quartos, ${imovel.num_banheiros || 0} banheiros, ${imovel.area_m2 || 0} m²</p>
                <p class="price">R$ ${parseFloat(imovel.preco || 0).toLocaleString('pt-BR')}</p>
                <button onclick="openModal('${imovel.titulo}', '${defaultImageUrl}')">Ver Fotos</button>
            </div>
        `;
        propertyGrid.appendChild(card);
    });
}

// Configura os formulários de autenticação (login/cadastro) e controla a visibilidade das seções
export function setupAuthForms() {
    console.log('setupAuthForms: Iniciando configuração de autenticação.');
    const authSection = document.getElementById('auth-section');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const userStatusDiv = document.getElementById('user-status');
    const publishPropertySection = document.getElementById('publish-property-section');
    const navLogoutBtn = document.getElementById('nav-logout-btn');

    async function updateAuthUI() {
        const { data: { user } } = await auth.getUser(); // Obtém o usuário logado

        if (user) {
            // --- BUSCA O PERFIL DO USUÁRIO PARA OBTER O PAPEL (ROLE) ---
            const { data: profile, error: profileError } = await db
                .from('usuarios') // SEU NOME DA TABELA DE PERFIS (ex: 'profiles' ou 'usuarios')
                .select('role') // Seleciona apenas a coluna 'role'
                .eq('id', user.id) // O ID do perfil deve ser o ID do usuário logado
                .single(); // Espera um único resultado para este ID

            if (profileError) {
                console.error('Erro ao buscar perfil do usuário:', profileError.message);
                alert('Seu perfil de usuário não pôde ser carregado. Tente novamente ou contate o suporte.');
                await auth.signOut(); // Desloga em caso de perfil corrompido/inexistente
                updateAuthUI();
                return;
            }

            const isAdmin = profile && profile.role === 'admin'; // Verifica se o papel é 'admin'
            console.log('Usuário logado:', user.email, 'É Admin?', isAdmin);

            // --- ATUALIZAÇÃO DA UI PARA USUÁRIO LOGADO ---
            if (userStatusDiv) { // Garante que a div existe na página atual
                userStatusDiv.style.display = 'block';
                userStatusDiv.innerHTML = `Bem-vindo, ${user.email} ${isAdmin ? '(Admin)' : ''}! <button id="logout-btn-inline">Sair</button>`;
            }
            
            // Oculta os formulários de login/cadastro
            if (loginForm) loginForm.style.display = 'none';
            if (signupForm) signupForm.style.display = 'none';
            if (authSection) authSection.style.display = 'none'; // Esconde a seção de formulários completa

            // Controla a visibilidade da seção de publicação (baseado no role)
            if (publishPropertySection) {
                if (isAdmin) { // Se o usuário logado for admin
                    publishPropertySection.style.display = 'block'; // Mostra a publicação
                } else { // Se o usuário logado NÃO for admin
                    publishPropertySection.style.display = 'none'; // Esconde a publicação
                    // Apenas se esta página for a de publicação (publish.html), avise ao usuário
                    if (window.location.pathname.includes('publish.html')) {
                       alert('Você não tem permissão para publicar imóveis. Apenas administradores podem fazer isso.');
                    }
                }
            }

            // Mostra o botão de sair na navegação
            if (navLogoutBtn) {
                navLogoutBtn.style.display = 'block';
                navLogoutBtn.onclick = async (e) => {
                    e.preventDefault();
                    const { error } = await auth.signOut();
                    if (error) console.error('Erro ao sair:', error.message);
                    else alert('Você foi desconectado.');
                    updateAuthUI(); // Atualiza a UI após o logout
                    window.location.href = 'index.html'; // Redireciona para a página inicial
                };
            }

            // Lógica para o botão de logout inline (se você o mantiver)
            const logoutInlineBtn = document.getElementById('logout-btn-inline');
            if (logoutInlineBtn) {
                logoutInlineBtn.onclick = async () => {
                    const { error } = await auth.signOut();
                    if (error) console.error('Erro ao sair:', error.message);
                    else alert('Você foi desconectado.');
                    updateAuthUI();
                    window.location.href = 'index.html'; // Redireciona para a página inicial
                };
            }

        } else {
            // --- ATUALIZAÇÃO DA UI PARA USUÁRIO NÃO LOGADO ---
            console.log('Nenhum usuário logado.');

            if (authSection) authSection.style.display = 'block'; // Mostra a seção de autenticação
            if (userStatusDiv) userStatusDiv.style.display = 'none'; // Oculta o status de boas-vindas
            
            if (loginForm) loginForm.style.display = 'block'; // Mostra formulário de login por padrão
            if (signupForm) signupForm.style.display = 'none'; // Oculta formulário de cadastro

            if (publishPropertySection) publishPropertySection.style.display = 'none'; // Oculta a seção de publicação
            if (navLogoutBtn) navLogoutBtn.style.display = 'none'; // Esconde o botão de sair na navegação
        }
    }

    // Ouve mudanças no estado de autenticação (login, logout, etc.)
    auth.onAuthStateChange((event, session) => {
        console.log('Auth state changed:', event, session);
        updateAuthUI(); // Atualiza a UI sempre que o estado muda
    });

    // Configura o formulário de login
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = loginForm['login-email'].value;
            const password = loginForm['login-password'].value;
            const { error } = await auth.signInWithPassword({ email, password });
            if (error) alert('Erro no login: ' + error.message);
            // updateAuthUI() será chamado automaticamente pelo onAuthStateChange
        });
    }

    // Configura o formulário de cadastro
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = signupForm['signup-email'].value;
            const password = signupForm['signup-password'].value;
            const { error } = await auth.signUp({ email, password });
            if (error) alert('Erro no cadastro: ' + error.message);
            else alert('Cadastro realizado! Verifique seu e-mail para confirmar a conta.');
            // updateAuthUI() será chamado automaticamente pelo onAuthStateChange
        });
    }

    updateAuthUI(); // Chama ao carregar a página para definir o estado inicial da UI
}

// Configura o formulário de publicação de imóveis
export function setupPropertySubmission() {
    const publishForm = document.getElementById('publish-form');
    console.log('setupPropertySubmission: Tentando configurar formulário de publicação.');

    if (!publishForm) {
        console.error('setupPropertySubmission: ERRO: Formulário de publicação (#publish-form) não encontrado no DOM.');
        return;
    }
    console.log('setupPropertySubmission: Formulário de publicação (#publish-form) encontrado. Anexando event listener.');

    publishForm.addEventListener('submit', async (e) => {
        console.log('EVENTO: Submit do formulário de publicação acionado.');
        e.preventDefault();

        const { data: { user } } = await auth.getUser();
        if (!user) {
            console.warn('EVENTO: Usuário não logado. Abortando publicação.');
            alert('Você precisa estar logado para publicar um imóvel.');
            return;
        }
        console.log('EVENTO: Usuário logado encontrado:', user.id);
        const usuarioId = user.id;

        const files = document.getElementById('prop-photos').files;
        if (files.length === 0) {
            console.warn('EVENTO: Nenhuma foto selecionada. Abortando publicação.');
            alert('Por favor, selecione pelo menos uma foto para o imóvel.');
            return;
        }
        console.log('EVENTO: Fotos selecionadas:', files.length);

        try {
            console.log('EVENTO: Iniciando inserção de dados do imóvel no Supabase.');
            const titulo = document.getElementById('prop-titulo').value;
            const descricao = document.getElementById('prop-descricao').value;
            const endereco = document.getElementById('prop-endereco').value;
            const preco = parseFloat(document.getElementById('prop-preco').value);
            const tipo_imovel = document.getElementById('prop-type').value;
            const num_quartos = parseInt(document.getElementById('prop-bedrooms').value);
            const num_banheiros = parseInt(document.getElementById('prop-bathrooms').value);
            const area_m2 = parseFloat(document.getElementById('prop-area').value);
            const status_imovel = document.getElementById('prop-status').value;

            const { data: imovelData, error: imovelError } = await db
                .from('imoveis')
                .insert({
                    titulo: titulo,
                    descricao: descricao,
                    endereco: endereco,
                    preco: preco,
                    tipo_imovel: tipo_imovel,
                    num_quartos: num_quartos,
                    num_banheiros: num_banheiros,
                    area_m2: area_m2,
                    status_imovel: status_imovel,
                    usuario_id: usuarioId,
                })
                .select();

            if (imovelError) throw imovelError;

            const novoImovel = imovelData[0];
            const novoImovelId = novoImovel.id;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const filePath = `${usuarioId}/${novoImovelId}/${Date.now()}-${file.name}`;

                const { error: uploadError } = await storage
                    .from('fotos-imoveis')
                    .upload(filePath, file);

                if (uploadError) {
                    console.error(`Erro ao fazer upload da foto ${file.name}:`, uploadError);
                    alert(`Erro ao fazer upload da foto ${file.name}: ${uploadError.message}. O imóvel será salvo, mas a foto pode estar faltando.`);
                    continue;
                }

                const { data: publicUrlData } = storage
                    .from('fotos-imoveis')
                    .getPublicUrl(filePath);

                const urlFoto = publicUrlData.publicUrl;

                const { error: fotoDbError } = await db
                    .from('fotos_imoveis')
                    .insert({
                        imovel_id: novoImovelId,
                        url_foto: urlFoto,
                        nome_arquivo: file.name,
                        usuario_id: usuarioId,
                    });

                if (fotoDbError) {
                    console.error(`Erro ao salvar URL da foto ${file.name} no banco de dados:`, fotoDbError);
                    alert(`Erro ao salvar a URL da foto ${file.name} no banco de dados. Contate o suporte.`);
                }
            }

            alert('Imóvel publicado com sucesso!');
            publishForm.reset();
            loadProperties();
            console.log('EVENTO: Publicação concluída com sucesso!');

        } catch (error) {
            console.error('ERRO GERAL na publicação do imóvel:', error.message);
            alert('Erro ao publicar imóvel: ' + error.message);
        }
    });
}