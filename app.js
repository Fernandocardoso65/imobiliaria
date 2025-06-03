// app.js
import { supabase, auth, storage, db } from './supabaseClient.js';

// --- Funções auxiliares (global para onclick no HTML) ---
export function openModal(title, photos) { // Modificado para aceitar 'photos' (array)
    document.getElementById('modal-title').textContent = title;
    const modalGallery = document.getElementById('modal-gallery'); // Referência ao novo contêiner
    if (!modalGallery) { // Garante que a galeria existe na página
        console.error('Div #modal-gallery não encontrada no modal.');
        return;
    }
    modalGallery.innerHTML = ''; // Limpa qualquer conteúdo anterior

    if (photos && photos.length > 0) {
        photos.forEach(photo => {
            const img = document.createElement('img');
            img.src = photo.url_foto; // Acesse a URL da foto
            img.alt = title; // Use o título do imóvel como alt
            // Estilos definidos no CSS global para #modal-gallery img
            modalGallery.appendChild(img);
        });
    } else {
        // Se não houver fotos, exiba uma imagem placeholder
        const img = document.createElement('img');
        img.src = 'https://via.placeholder.com/800x400?text=Nenhuma+Foto+Disponível';
        img.alt = 'Nenhuma foto disponível';
        img.style.width = '100%';
        img.style.height = 'auto';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '5px';
        modalGallery.appendChild(img);
    }

    document.getElementById('modal').style.display = 'flex'; // Exibe o modal
};

export function closeModal() {
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

// --- FUNÇÃO AUXILIAR: Sanear nome do arquivo para upload ---
function sanitizeFileName(fileName) {
    return fileName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9.\-_]/g, "-")
        .replace(/--+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
}


// --- FUNÇÕES DE INTEGRAÇÃO SUPABASE ---

// Carrega e exibe os imóveis na página principal (index.html)
export async function loadProperties() {
    const propertyGrid = document.getElementById('property-grid');
    if (!propertyGrid) {
        console.warn('Div #property-grid não encontrada. loadProperties não será executada nesta página.');
        return;
    }
    propertyGrid.innerHTML = '<p>Carregando imóveis...</p>';

    const { data: imoveis, error: imovelError } = await db
        .from('imoveis')
        .select(`
            id,
            titulo,
            descricao,
            endereco,
            preco,
            tipo_imovel,
            num_quartos,
            num_banheiros,
            area_m2,
            status_imovel,
            usuario_id,
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

    // NOVO: Verifica o status do usuário apenas UMA vez para a exibição de botões de exclusão
    const { data: { user } } = await auth.getUser();
    let isAdmin = false;
    if (user) {
        const { data: profile, error: profileError } = await db
            .from('usuarios')
            .select('role')
            .eq('id', user.id)
            .single();
        if (!profileError) {
            isAdmin = profile.role === 'admin';
        } else {
            console.error('Erro ao buscar perfil para verificar admin em loadProperties:', profileError.message);
        }
    }


    imoveis.forEach(imovel => {
        const allPhotos = imovel.fotos_imoveis || []; // Garante que é um array, mesmo que vazio
        const defaultImageUrl = allPhotos.length > 0
            ? allPhotos[0].url_foto
            : 'https://via.placeholder.com/500x200?text=Sem+Foto';

        const card = document.createElement('div');
        card.className = 'property-card';
        card.setAttribute('data-type', imovel.tipo_imovel || '');
        card.setAttribute('data-price', imovel.preco || 0);
        card.setAttribute('data-bedrooms', imovel.num_quartos || 0);
        card.setAttribute('data-status', imovel.status_imovel || 'Pronto');
        // Armazena todas as fotos no dataset para passar para o modal
        card.setAttribute('data-photos', JSON.stringify(allPhotos));


        card.innerHTML = `
            <img src="${defaultImageUrl}" alt="${imovel.titulo || 'Imóvel'}">
            <div class="property-info">
                <h3>${imovel.titulo}</h3>
                <p>${imovel.endereco || ''}, Piedade, SP</p>
                <p>${imovel.num_quartos || 0} quartos, ${imovel.num_banheiros || 0} banheiros, ${imovel.area_m2 || 0} m²</p>
                <p class="price">R$ ${parseFloat(imovel.preco || 0).toLocaleString('pt-BR')}</p>
                <button class="btn-ver-fotos">Ver Fotos</button>
                
                <button class="btn-excluir" data-imovel-id="${imovel.id}" style="display: ${isAdmin ? 'block' : 'none'};">Excluir</button>
            </div>
        `;
        propertyGrid.appendChild(card);

        // NOVO: Adiciona listener para o botão "Ver Fotos" para passar os dados corretos
        card.querySelector('.btn-ver-fotos').addEventListener('click', (e) => {
            const title = imovel.titulo || 'Imóvel';
            const photosString = card.getAttribute('data-photos');
            const photos = JSON.parse(photosString); // Converte de volta para array
            openModal(title, photos); // Chama openModal com todas as fotos
        });
    });

    // NOVO: Adiciona listener para o botão "Excluir" em TODOS os cards
    document.querySelectorAll('.btn-excluir').forEach(button => {
        button.addEventListener('click', async (e) => {
            const imovelId = e.target.getAttribute('data-imovel-id');
            if (confirm(`Tem certeza que deseja excluir o imóvel ID ${imovelId}? Todas as fotos também serão removidas.`)) {
                await deleteImovel(imovelId);
            }
        });
    });
}

// NOVO: Função para deletar imóvel
async function deleteImovel(imovelId) {
    try {
        // 1. Deletar as fotos do Storage PRIMEIRO (arquivos)
        const { data: fotos, error: fotosError } = await db
            .from('fotos_imoveis')
            .select('url_foto') // Apenas a url_foto para pegar o path
            .eq('imovel_id', imovelId);

        if (fotosError) {
            console.error('Erro ao buscar fotos para deleção:', fotosError.message);
            // Continua a deleção do imóvel mesmo se não conseguir listar as fotos
        } else if (fotos.length > 0) {
            const filesToDelete = fotos.map(foto => {
                // O 'path' no Storage é o que precisamos para deletar
                // A URL pública é https://<PROJECT_REF>.supabase.co/storage/v1/object/public/<BUCKET_NAME>/<PATH_TO_FILE>
                // Então, o path é tudo depois de /public/<BUCKET_NAME>/
                const bucketName = 'fotos-imoveis'; // Seu nome do bucket
                // Assegura que o path realmente contém o nome do bucket antes de splitar
                if (foto.url_foto && foto.url_foto.includes(`/${bucketName}/`)) {
                    return foto.url_foto.split(`/${bucketName}/`)[1];
                }
                return null; // Retorna null se o formato da URL não for o esperado
            }).filter(path => path); // Filtra paths nulos

            if (filesToDelete.length > 0) {
                const { data: deleteFilesData, error: deleteFilesError } = await storage
                    .from(bucketName)
                    .remove(filesToDelete); // Remove múltiplos arquivos

                if (deleteFilesError) {
                    console.error('Erro ao deletar arquivos do Storage:', deleteFilesError.message);
                    alert('Erro ao deletar algumas fotos do armazenamento. O imóvel será removido, mas as fotos podem permanecer.');
                } else {
                    console.log('Arquivos do Storage deletados com sucesso:', deleteFilesData);
                }
            }
        }

        // 2. Deletar o registro do imóvel do banco de dados (fotos_imoveis serão CASCADE deletadas)
        const { error: imovelDeleteError } = await db
            .from('imoveis')
            .delete()
            .eq('id', imovelId);

        if (imovelDeleteError) {
            throw imovelDeleteError;
        }

        alert('Imóvel e fotos associadas excluídos com sucesso!');
        loadProperties(); // Recarrega a lista para remover o imóvel deletado
    } catch (error) {
        console.error('Erro ao excluir imóvel:', error.message);
        alert('Erro ao excluir imóvel: ' + error.message);
    }
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
            const { data: profile, error: profileError } = await db
                .from('usuarios')
                .select('role')
                .eq('id', user.id)
                .single();

            if (profileError) {
                console.error('Erro ao buscar perfil do usuário:', profileError.message);
                alert('Seu perfil de usuário não pôde ser carregado. Tente novamente ou contate o suporte.');
                await auth.signOut();
                updateAuthUI();
                return;
            }

            const isAdmin = profile && profile.role === 'admin';
            console.log('Usuário logado:', user.email, 'É Admin?', isAdmin);

            if (userStatusDiv) {
                userStatusDiv.style.display = 'block';
                userStatusDiv.innerHTML = `Bem-vindo, ${user.email} ${isAdmin ? '(Admin)' : ''}! <button id="logout-btn-inline">Sair</button>`;
            }
            
            if (loginForm) loginForm.style.display = 'none';
            if (signupForm) signupForm.style.display = 'none';
            if (authSection) authSection.style.display = 'none';

            if (publishPropertySection) {
                if (isAdmin) {
                    publishPropertySection.style.display = 'block';
                } else {
                    publishPropertySection.style.display = 'none';
                    if (window.location.pathname.includes('publish.html')) {
                       alert('Você não tem permissão para publicar imóveis. Apenas administradores podem fazer isso.');
                    }
                }
            }

            if (navLogoutBtn) {
                navLogoutBtn.style.display = 'block';
                navLogoutBtn.onclick = async (e) => {
                    e.preventDefault();
                    const { error } = await auth.signOut();
                    if (error) console.error('Erro ao sair:', error.message);
                    else alert('Você foi desconectado.');
                    updateAuthUI();
                    window.location.href = 'index.html';
                };
            }

            const logoutInlineBtn = document.getElementById('logout-btn-inline');
            if (logoutInlineBtn) {
                logoutInlineBtn.onclick = async () => {
                    const { error } = await auth.signOut();
                    if (error) console.error('Erro ao sair:', error.message);
                    else alert('Você foi desconectado.');
                    updateAuthUI();
                    window.location.href = 'index.html';
                };
            }

        } else {
            console.log('Nenhum usuário logado.');

            if (authSection) authSection.style.display = 'block';
            if (userStatusDiv) userStatusDiv.style.display = 'none';
            
            if (loginForm) loginForm.style.display = 'block';
            if (signupForm) signupForm.style.display = 'none';

            if (publishPropertySection) publishPropertySection.style.display = 'none';
            if (navLogoutBtn) navLogoutBtn.style.display = 'none';
        }
    }

    auth.onAuthStateChange((event, session) => {
        console.log('Auth state changed:', event, session);
        updateAuthUI();
    });

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = loginForm['login-email'].value;
            const password = loginForm['login-password'].value;
            const { error } = await auth.signInWithPassword({ email, password });
            if (error) alert('Erro no login: ' + error.message);
        });
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = signupForm['signup-email'].value;
            const password = signupForm['signup-password'].value;
            const { error } = await auth.signUp({ email, password });
            if (error) alert('Erro no cadastro: ' + error.message);
            else alert('Cadastro realizado! Verifique seu e-mail para confirmar a conta.');
        });
    }

    updateAuthUI();
}

// Configura o formulário de publicação de imóveis
export function setupPropertySubmission() {
    console.log('setupPropertySubmission: Tentando configurar formulário de publicação.');

    const publishForm = document.getElementById('publish-form');
    if (!publishForm) {
        console.error('setupPropertySubmission: ERRO: Formulário de publicação (#publish-form) não encontrado no DOM. Esta função pode estar sendo chamada em uma página onde o formulário não existe.');
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
                const sanitizedFileName = sanitizeFileName(file.name);
                const filePath = `${usuarioId}/${novoImovelId}/${Date.now()}-${sanitizedFileName}`;

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
