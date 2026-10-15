# Cenários de Teste (BDD) — Sistema Instituto Missão Art

Cenários no formato **Dado / Quando / Então**, um passo por linha, sem encadear com "E". Servem como checklist de regressão manual (o projeto ainda não tem testes automatizados).

Seções 1 a 9: cenários criados após as Fases 2 a 11. Seções 10 a 14: módulos construídos depois (exportação Excel, ficha de saúde, rematrícula na lista, ambientes, exclusão de documentos).

> Antes de testar: ambiente `'teste'` no `config.js`, um usuário criado com `node create-usuario.js` e, se quiser partir do zero, `node resetar-banco-teste.js`.

---

## 1. Autenticação e Acesso

**Login com credenciais válidas**

- Dado que existe um usuário cadastrado com e-mail e senha válidos
- Quando esse usuário envia o login com o e-mail correto, junto da senha correta
- Então o sistema cria a sessão e libera o acesso às páginas protegidas

**Login com senha incorreta**

- Dado que existe um usuário cadastrado com uma senha conhecida
- Quando esse usuário tenta logar com a senha errada
- Então o sistema recusa o login com a mensagem "E-mail ou senha inválidos."

**Login com e-mail não cadastrado**

- Dado que não existe nenhum usuário cadastrado com um determinado e-mail
- Quando alguém tenta logar usando esse e-mail
- Então o sistema recusa o login com a mensagem "E-mail ou senha inválidos."

**Acesso a página protegida sem sessão ativa**

- Dado que ninguém está autenticado no navegador
- Quando alguém tenta acessar a página inicial do sistema diretamente pela URL
- Então o sistema redireciona para a tela de login

**Logout encerra a sessão**

- Dado que um usuário está autenticado no sistema
- Quando esse usuário clica em "Sair"
- Então a sessão é destruída, redirecionando para a tela de login

**Acesso à API sem sessão ativa**

- Dado que ninguém está autenticado no navegador
- Quando uma requisição à lista de alunos é enviada diretamente à API
- Então o sistema responde com erro de acesso não autorizado

---

## 2. Cadastro de Aluno

**Cadastro com dados mínimos válidos**

- Dado que o formulário de novo aluno tem nome preenchido com ao menos um responsável legal com nome
- Quando o usuário clica em "Salvar aluno"
- Então o aluno é criado com status "ativo" por padrão

**Cadastro sem nome**

- Dado que o formulário de novo aluno foi preenchido sem nenhum nome
- Quando o usuário tenta salvar o cadastro
- Então o sistema recusa a operação com a mensagem "O nome do aluno é obrigatório."

**Cadastro sem responsável legal**

- Dado que o formulário de novo aluno tem nome preenchido mas nenhum responsável legal informado
- Quando o usuário tenta salvar o cadastro
- Então o sistema recusa a operação com a mensagem "É obrigatório informar ao menos um responsável legal."

**Edição de aluno existente**

- Dado que existe um aluno já cadastrado no sistema
- Quando o usuário altera algum dado da ficha, clicando em "Salvar aluno"
- Então os dados do aluno são atualizados no banco

**Edição de aluno inexistente**

- Dado que um identificador não corresponde a nenhum aluno cadastrado
- Quando uma requisição de atualização é enviada para esse identificador
- Então o sistema responde com o erro "Aluno não encontrado" e código 404

**Erro inesperado não expõe detalhes técnicos**

- Dado que ocorre uma falha interna do servidor durante uma operação
- Quando o sistema responde ao usuário
- Então a mensagem exibida é genérica, com o detalhe técnico registrado apenas no terminal do servidor

---

## 3. Responsável Legal

**Reaproveitamento de responsável por CPF**

- Dado que já existe um responsável cadastrado com um determinado CPF
- Quando um novo aluno é salvo informando um responsável com esse mesmo CPF
- Então o sistema reaproveita o cadastro existente do responsável em vez de duplicá-lo

**Primeiro responsável informado é o principal**

- Dado que um aluno é cadastrado com mais de um responsável legal na lista
- Quando o cadastro é salvo
- Então o primeiro responsável da lista é marcado como responsável principal

**Aluno com mais de um responsável**

- Dado que um aluno é cadastrado com dois responsáveis legais
- Quando o usuário abre a ficha desse aluno
- Então os dois responsáveis aparecem vinculados a ele, com o parentesco informado

---

## 4. Modalidades e Matrícula

**Aluno menor de idade em modalidade infantil**

- Dado que um aluno tem menos de 18 anos de idade
- Quando esse aluno é matriculado numa modalidade exclusiva para o público infantil
- Então a matrícula é aceita normalmente

**Aluno maior de idade em modalidade só infantil**

- Dado que um aluno tem 18 anos ou mais de idade
- Quando esse aluno é matriculado numa modalidade exclusiva para o público infantil
- Então o sistema recusa a matrícula informando que a modalidade é exclusiva para o público infantil

**Aluno maior de idade no Box**

- Dado que um aluno tem 18 anos ou mais de idade
- Quando esse aluno é matriculado na modalidade Box
- Então a matrícula é aceita normalmente, já que essa modalidade aceita adultos

**Aluno em mais de uma modalidade**

- Dado que um aluno menor de idade está cadastrado
- Quando o usuário seleciona duas modalidades na ficha, salvando em seguida
- Então as duas modalidades ficam vinculadas à matrícula do aluno no ano letivo vigente

**Cadastro de modalidade nova**

- Dado que não existe modalidade cadastrada com um determinado nome
- Quando o usuário cadastra uma modalidade com esse nome
- Então a modalidade passa a aparecer na lista de modalidades disponíveis

**Cadastro de modalidade com nome duplicado**

- Dado que já existe uma modalidade cadastrada com um determinado nome
- Quando alguém tenta cadastrar outra modalidade com esse mesmo nome
- Então o sistema recusa com a mensagem "Já existe uma modalidade com esse nome."

**Cadastro de modalidade sem nome**

- Dado que o campo de nome da nova modalidade está vazio
- Quando o usuário tenta cadastrar a modalidade
- Então o sistema recusa a operação pedindo o nome da modalidade

---

## 5. Status do Aluno e Lista de Espera

**Promoção da lista de espera para ativo**

- Dado que um aluno está com o status "lista de espera"
- Quando a ação rápida "Promover" é acionada na listagem
- Então o status do aluno passa para "ativo", apagando a data de entrada na lista de espera

**Entrada automática de data na lista de espera**

- Dado que um aluno está sendo movido para o status "lista de espera" sem informar uma data
- Quando a alteração de status é aplicada
- Então o sistema preenche a data de entrada na lista de espera com a data atual

**Status inválido é recusado**

- Dado que uma requisição de alteração de status envia um valor fora de ativo, inativo ou lista de espera
- Quando essa requisição é processada
- Então o sistema recusa a operação com a mensagem "Status inválido."

**Inativar aluno**

- Dado que um aluno está com o status "ativo"
- Quando o usuário altera o status dele para "inativo"
- Então o aluno passa a aparecer como inativo na listagem

**Filtro por status na listagem**

- Dado que existem alunos com status diferentes cadastrados no sistema
- Quando o filtro de status "Ativo" é aplicado na listagem
- Então apenas os alunos com status ativo aparecem na lista

---

## 6. Upload de Arquivos

**Upload de foto com tipo de arquivo permitido**

- Dado que um aluno já está cadastrado no sistema
- Quando uma imagem JPEG, PNG ou WEBP é enviada como foto desse aluno
- Então o arquivo é salvo, ficando o caminho da foto vinculado ao cadastro

**Upload de foto com tipo de arquivo não permitido**

- Dado que um aluno já está cadastrado no sistema
- Quando um arquivo PDF é enviado como foto desse aluno
- Então o sistema recusa o upload informando os tipos aceitos

**Upload de documento com tipo não permitido**

- Dado que um aluno já está cadastrado no sistema
- Quando um arquivo de um tipo não permitido, como .txt, é enviado como documento desse aluno
- Então o sistema recusa o upload informando os tipos aceitos

**Upload de arquivo acima do tamanho máximo**

- Dado que um aluno já está cadastrado no sistema
- Quando um arquivo com mais de 5 MB é enviado
- Então o sistema recusa o upload informando o limite de tamanho

**Upload de documento sem informar o tipo**

- Dado que um aluno já está cadastrado no sistema
- Quando um documento é enviado sem o campo de tipo do documento preenchido
- Então o sistema recusa a operação com a mensagem "Informe o tipo do documento." sem deixar arquivo salvo em disco

**Upload de arquivo para aluno inexistente não deixa órfão**

- Dado que um identificador não corresponde a nenhum aluno cadastrado
- Quando um arquivo é enviado para esse identificador
- Então o sistema recusa a operação, ficando nenhum arquivo salvo em disco

**Remoção de documento apaga o arquivo físico**

- Dado que um documento já foi anexado a um aluno
- Quando esse documento é removido pela listagem de documentos
- Então o registro some do banco, com o arquivo correspondente apagado do disco

**Remoção de documento de outro aluno é recusada**

- Dado que um documento pertence a um aluno diferente do informado na requisição
- Quando a remoção é solicitada com o identificador do outro aluno
- Então o sistema responde com o erro "Documento não encontrado" e código 404

**Termo de imagem por aceite digital**

- Dado que um responsável decidiu autorizar o uso de imagem digitalmente
- Quando o aceite digital é registrado para o aluno
- Então a data do aceite é gravada, sem nenhum arquivo associado ao termo

**Termo de imagem por upload do documento assinado**

- Dado que um responsável assinou o termo em papel
- Quando o arquivo assinado é enviado como termo de imagem do aluno
- Então o arquivo fica associado ao termo, com o aceite digital desmarcado

**Aceite digital substitui o arquivo assinado**

- Dado que um aluno já tem um termo de imagem com arquivo assinado
- Quando o aceite digital é registrado para o mesmo aluno
- Então o termo passa a constar apenas como aceite digital, sem arquivo associado

**Acesso a arquivo enviado sem estar logado**

- Dado que ninguém está autenticado no navegador
- Quando alguém tenta acessar diretamente o link de um arquivo enviado
- Então o sistema bloqueia o acesso, redirecionando para o login

---

## 7. Rematrícula Anual

**Aluno pendente de rematrícula aparece na fila**

- Dado que um aluno teve modalidade vinculada em um ano letivo anterior mas não no ano letivo vigente
- Quando a lista de pendentes de rematrícula é consultada
- Então esse aluno aparece nessa lista

**Aluno já rematriculado não aparece como pendente**

- Dado que um aluno já tem modalidade vinculada no ano letivo vigente
- Quando a lista de pendentes de rematrícula é consultada
- Então esse aluno não aparece nessa lista

**Aluno inativo não entra na fila de rematrícula**

- Dado que um aluno com status inativo teve modalidade vinculada apenas em anos anteriores
- Quando a lista de pendentes de rematrícula é consultada
- Então esse aluno não aparece nessa lista

**Matrícula vazia não conta como matriculado**

- Dado que um aluno tem uma matrícula no ano vigente sem nenhuma modalidade vinculada
- Quando a lista de pendentes de rematrícula é consultada
- Então esse aluno continua aparecendo como pendente

**Sugestão de modalidades do ano anterior**

- Dado que um aluno pendente de rematrícula teve modalidades vinculadas no último ano em que esteve matriculado
- Quando a situação de matrícula desse aluno é consultada
- Então o sistema retorna as modalidades daquele ano como sugestão

**Aluno novo nunca matriculado não é pendente**

- Dado que um aluno acabou de ser cadastrado sem nenhuma modalidade em ano algum
- Quando a lista de pendentes de rematrícula é consultada
- Então esse aluno não aparece nessa lista

---

## 8. Busca e Filtros

**Busca por nome**

- Dado que existe um aluno cadastrado com um nome específico
- Quando esse nome, ou parte dele, é usado no campo de busca
- Então o aluno correspondente aparece na listagem

**Busca por CPF**

- Dado que existe um aluno cadastrado com um CPF específico
- Quando esse CPF é usado no campo de busca
- Então o aluno correspondente aparece na listagem

**Filtro por modalidade**

- Dado que existem alunos matriculados em modalidades diferentes no ano letivo vigente
- Quando o filtro de uma modalidade específica é aplicado
- Então somente os alunos matriculados nela aparecem na listagem

**Filtro de modalidade sem repetir aluno**

- Dado que um aluno está matriculado em duas modalidades no ano vigente
- Quando a listagem é consultada sem filtro de modalidade
- Então esse aluno aparece uma única vez na lista

**Filtros combinados sem resultado**

- Dado que o filtro de modalidade escolhido não tem nenhum aluno em comum com o termo de busca digitado
- Quando os dois filtros são aplicados juntos
- Então a listagem retorna vazia

**Filtro de pendentes de rematrícula na tela**

- Dado que existem alunos pendentes de rematrícula cadastrados
- Quando a caixa de seleção de pendentes é marcada na listagem
- Então somente os alunos pendentes aparecem na lista

---

## 9. Identidade Visual e Sessão

**Nome do usuário logado na topbar**

- Dado que um usuário está autenticado no sistema
- Quando a página principal é carregada
- Então o nome desse usuário aparece na topbar

**Página inicial redireciona para Alunos**

- Dado que um usuário está autenticado no sistema
- Quando a raiz do sistema é acessada
- Então a listagem de Alunos é exibida como página inicial

**Logo na tela de login**

- Dado que ninguém está autenticado no navegador
- Quando a tela de login é aberta
- Então a logo do Instituto aparece acima do formulário

---

## 10. Ficha de Saúde

**Salvar problemas de saúde do catálogo**

- Dado que existe um aluno cadastrado
- Quando o usuário marca dois problemas de saúde do catálogo, salvando em seguida
- Então os dois problemas ficam vinculados ao aluno ao reabrir a ficha

**Desmarcar problema de saúde**

- Dado que um aluno tem um problema de saúde marcado na ficha
- Quando o usuário desmarca esse problema, salvando em seguida
- Então o vínculo é removido da ficha do aluno

**Registrar doenças contagiosas já tidas**

- Dado que existe um aluno cadastrado
- Quando o usuário marca uma doença contagiosa do catálogo, salvando em seguida
- Então a doença fica registrada na ficha do aluno

**Campo de detalhe junto da resposta "Sim"**

- Dado que o aluno usa remédio contínuo
- Quando o usuário marca "Sim" informando o nome do remédio, salvando em seguida
- Então a ficha guarda a resposta, incluindo o nome do remédio informado

**Catálogos disponíveis para preenchimento**

- Dado que o sistema foi iniciado pela primeira vez
- Quando a lista de problemas de saúde é consultada
- Então ela retorna os 16 itens do catálogo fixo

---

## 11. Exportação para Excel

**Exportar a lista completa**

- Dado que existem alunos cadastrados no sistema
- Quando o usuário clica em "Exportar (Excel)" sem nenhum filtro aplicado
- Então o navegador baixa um arquivo .xlsx com uma linha para cada aluno

**Nome do arquivo com a data**

- Dado que o usuário exporta a lista de alunos
- Quando o download é concluído
- Então o arquivo se chama "alunos-" seguido da data de hoje no formato AAAA-MM-DD

**Exportação respeita o filtro de status**

- Dado que o filtro de status "Ativo" está aplicado na tela
- Quando o usuário clica em "Exportar (Excel)"
- Então o arquivo traz somente os alunos com status ativo

**Exportação respeita a busca por nome**

- Dado que um nome está digitado no campo de busca
- Quando o usuário clica em "Exportar (Excel)"
- Então o arquivo traz somente os alunos que correspondem à busca

**Exportação respeita o filtro de modalidade**

- Dado que o filtro de uma modalidade específica está aplicado
- Quando o usuário clica em "Exportar (Excel)"
- Então o arquivo traz somente os alunos matriculados nela

**Ficha completa nas colunas**

- Dado que o usuário abre o arquivo exportado
- Quando a primeira linha da planilha é lida
- Então o cabeçalho apresenta dados básicos, status, modalidades, responsáveis, saúde, observações

**Respostas de sim ou não legíveis**

- Dado que um aluno marcou "fumante" na ficha de saúde
- Quando a planilha é aberta
- Então a coluna "Fumante" mostra "Sim" em vez de um número

**Ids de catálogo traduzidos em nomes**

- Dado que um aluno tem modalidades e problemas de saúde marcados
- Quando a planilha é aberta
- Então as colunas mostram os nomes separados por vírgula, nunca os identificadores

**Responsáveis concatenados na mesma célula**

- Dado que um aluno tem dois responsáveis cadastrados
- Quando a planilha é aberta
- Então a célula lista nome, parentesco e telefone de cada um, separados por " | ", com "[Principal]" no primeiro

**Exportação sem resultados**

- Dado que os filtros aplicados não retornam nenhum aluno
- Quando o usuário clica em "Exportar (Excel)"
- Então o arquivo é gerado apenas com a linha de cabeçalho

**Exportação sem sessão ativa**

- Dado que ninguém está autenticado no navegador
- Quando a rota de exportação é acessada diretamente pela URL
- Então o sistema nega o acesso, sem entregar nenhum arquivo

**Cabeçalho visível ao rolar**

- Dado que a planilha tem muitas linhas de alunos
- Quando o usuário rola para baixo no Excel
- Então a linha de cabeçalho permanece congelada no topo

---

## 12. Ambientes de Teste e Produção

**Banner no ambiente de teste**

- Dado que o `config.js` está com o ambiente "teste"
- Quando qualquer página do sistema é aberta
- Então um aviso informa que os dados são de teste

**Sem banner em produção**

- Dado que o `config.js` está com o ambiente "producao"
- Quando qualquer página do sistema é aberta
- Então nenhum aviso de dados de teste é exibido

**Bancos separados por ambiente**

- Dado que o sistema foi iniciado em ambiente de teste
- Quando um aluno é cadastrado
- Então o registro é gravado em "dados-teste.db", sem tocar em "dados.db"

**Reset do banco de teste**

- Dado que o ambiente é "teste" com alunos cadastrados
- Quando o script de reset é executado
- Então o banco volta ao estado inicial, com catálogos e ano letivo recriados

**Reset bloqueado em produção**

- Dado que o ambiente é "producao"
- Quando o script de reset é executado
- Então o script se recusa a rodar, preservando os dados reais

**Ano letivo criado automaticamente**

- Dado que o banco é novo
- Quando o servidor inicia
- Então o ano letivo do ano corrente é criado sem ação do usuário

---

## 13. Criação de Usuário e Execução

**Criar usuário pelo terminal**

- Dado que nenhum usuário usa um determinado e-mail
- Quando o comando `create-usuario.js` é executado com nome, e-mail, senha
- Então o usuário é criado, conseguindo logar na tela de login

**Criar usuário com e-mail repetido**

- Dado que já existe um usuário com um determinado e-mail
- Quando o comando é executado novamente com esse e-mail
- Então o script informa que o e-mail já está cadastrado, sem criar duplicado

**Senha guardada com hash**

- Dado que um usuário foi criado pelo script
- Quando o banco é inspecionado
- Então a senha aparece como hash bcrypt, nunca em texto puro

**Acesso a partir de outro computador da rede**

- Dado que o servidor está rodando em um PC com a porta 3000 liberada
- Quando outro computador da mesma rede abre o IP do servidor na porta 3000
- Então a tela de login é exibida normalmente

**Instalação do zero**

- Dado que o projeto foi clonado sem a pasta de dependências
- Quando o comando `npm install` é executado
- Então o servidor inicia com `node server.js`, sem erro de módulo ausente

---

## 14. Regressões já corrigidas (manter no checklist)

**Rota estática não confundida com identificador**

- Dado que existem as rotas "pendentes-rematricula" e "exportar" na API de alunos
- Quando uma delas é acessada
- Então a resposta vem da própria rota, nunca do detalhe de um aluno com esse "id"

**Matrícula vazia na rematrícula**

- Dado que um aluno tem matrícula do ano atual sem modalidade
- Quando a situação de matrícula é consultada
- Então o aluno é tratado como não matriculado

**Arquivo órfão em upload inválido**

- Dado que o upload é recusado por validação
- Quando o disco de uploads é verificado
- Então nenhum arquivo daquele envio permanece salvo

---

## Pontos para decidir após os testes

- Limite de tentativas de login (hoje não existe).
- Troca do segredo da sessão, hoje fixo no código.
- Perfis de acesso diferentes (hoje todo usuário logado pode tudo).
- Exclusão ou arquivamento definitivo de alunos (hoje só existe o status "inativo").
