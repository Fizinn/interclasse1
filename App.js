import { collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc, increment } from 'firebase/firestore';
import { db } from './firebaseConfig';

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from 'react-native';

export default function App() {
  const senhaOrganizador = 'CEETIM@Inter2026#PF';

  const [abaAtual, setAbaAtual] = useState('jogos');

  const [organizadorLogado, setOrganizadorLogado] = useState(false);
  const [senha, setSenha] = useState('');
  const [mostrarLoginOrganizador, setMostrarLoginOrganizador] = useState(false);

  const [novoTime1, setNovoTime1] = useState('');
  const [novoTime2, setNovoTime2] = useState('');
  const [novoTempo, setNovoTempo] = useState('10');
  const [novaModalidade, setNovaModalidade] = useState('Futsal');

  // Fase do jogo (só usado quando novaModalidade === 'Futsal')
  const [novaFase, setNovaFase] = useState('grupos'); // 'grupos' | 'mata-mata'
  const [novoGrupoNome, setNovoGrupoNome] = useState('');
  const [novoRotuloMataMata, setNovoRotuloMataMata] = useState('');

  const [jogos, setJogos] = useState([]);

  // Grupos do Futsal
  const [gruposFutsal, setGruposFutsal] = useState([]);
  const [novoNomeGrupo, setNovoNomeGrupo] = useState('');
  const [timeInputPorGrupo, setTimeInputPorGrupo] = useState({});
  const [jogadorInputPorTime, setJogadorInputPorTime] = useState({});

  const [modalGolInfo, setModalGolInfo] = useState(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'jogos'),
      (snapshot) => {
        const lista = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        }));

        setJogos(lista);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'gruposFutsal'),
      (snapshot) => {
        const lista = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        }));

        setGruposFutsal(lista);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      jogos.forEach(async (jogo) => {
        if (jogo.modalidade === 'Vôlei') return;
        if (jogo.status !== 'AO VIVO') return;
        if (jogo.intervalo) return;
        if (jogo.tempo <= 0) return;

        const jogoRef = doc(db, 'jogos', jogo.id);

        await updateDoc(jogoRef, {
          tempo: increment(-1),
        });
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [jogos]);

  function formatarTempo(segundos) {
    const min = Math.floor(segundos / 60);
    const seg = segundos % 60;

    return `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
  }

  // AO VIVO primeiro, depois PRÓXIMO, e FINALIZADO por último.
  // Dentro de cada grupo mantém a ordem original (mais recentes por último).
  function ordenarJogosPorStatus(lista) {
    const ordem = { 'AO VIVO': 0, 'PRÓXIMO': 1, 'FINALIZADO': 2 };

    return lista
      .map((jogo, index) => ({ jogo, index }))
      .sort((a, b) => {
        const ordemA = ordem[a.jogo.status] ?? 1;
        const ordemB = ordem[b.jogo.status] ?? 1;

        if (ordemA !== ordemB) return ordemA - ordemB;
        return a.index - b.index;
      })
      .map(({ jogo }) => jogo);
  }

  function loginOrganizador() {
    if (senha === senhaOrganizador) {
      setOrganizadorLogado(true);
      setSenha('');
      setMostrarLoginOrganizador(true); // já abre o painel direto após logar
    } else {
      Alert.alert('Senha incorreta');
    }
  }

  // Só esconde o painel da tela (não desloga). Enquanto a aba não for
  // recarregada, a senha continua válida e reabrir pelo ☰ não pede de novo.
  function fecharPainelOrganizador() {
    setMostrarLoginOrganizador(false);
  }

  // Retorna os nomes de times já conhecidos pra essa modalidade, sem duplicar
  // (junta os times cadastrados nos grupos + times usados em jogos anteriores).
  function obterNomesTimesConhecidos(modalidade) {
    const vistos = new Map(); // chave normalizada -> nome original

    function registrar(nome) {
      const limpo = (nome || '').trim();
      if (!limpo) return;
      const chave = limpo.toLowerCase();
      if (!vistos.has(chave)) {
        vistos.set(chave, limpo);
      }
    }

    if (modalidade === 'Futsal') {
      gruposFutsal.forEach((grupo) => {
        (grupo.times || []).forEach(registrar);
      });
    }

    jogos
      .filter((jogo) => jogo.modalidade === modalidade)
      .forEach((jogo) => {
        registrar(jogo.time1);
        registrar(jogo.time2);
      });

    return Array.from(vistos.values()).sort((a, b) => a.localeCompare(b));
  }

  function criarJogo() {
    const time1 = novoTime1.trim();
    const time2 = novoTime2.trim();

    if (!time1 || !time2) {
      Alert.alert('Preencha os times');
      return;
    }

    if (time1.toLowerCase() === time2.toLowerCase()) {
      Alert.alert('Os dois times não podem ser o mesmo');
      return;
    }

    if (
      novaModalidade === 'Futsal' &&
      novaFase === 'grupos' &&
      gruposFutsal.length > 0 &&
      !novoGrupoNome
    ) {
      Alert.alert('Selecione o grupo do jogo');
      return;
    }

    const minutos = Number(novoTempo);

    const novoJogo = {
      id: Date.now().toString(),
      modalidade: novaModalidade,
      time1,
      time2,
      placar1: 0,
      placar2: 0,
      status: 'PRÓXIMO',
      tempo: minutos * 60,
      tempoOriginal: minutos * 60,
      intervalo: false,
      acrescimo: 0,
      emAcrescimo: false,
      periodo: 1,
      sets1: 0,
      sets2: 0,
      fase: novaModalidade === 'Futsal' ? novaFase : null,
      grupo:
        novaModalidade === 'Futsal' && novaFase === 'grupos'
          ? novoGrupoNome || null
          : null,
      faseMataMata:
        novaModalidade === 'Futsal' && novaFase === 'mata-mata'
          ? novoRotuloMataMata.trim() || 'Mata-mata'
          : null,
      golsDetalhados: [],
    };

    addDoc(collection(db, 'jogos'), novoJogo);

    setNovoTime1('');
    setNovoTime2('');
    setNovoTempo('10');
    setNovaFase('grupos');
    setNovoGrupoNome('');
    setNovoRotuloMataMata('');
  }

  async function alterarPlacar(id, lado, valor) {
    const jogo = jogos.find((j) => j.id === id);
    if (!jogo) return;

    const jogoRef = doc(db, 'jogos', id);

    // Evita placar negativo sem precisar ler o valor mais recente do servidor.
    if (lado === 1) {
      if (jogo.placar1 + valor < 0) return;
      await updateDoc(jogoRef, {
        placar1: increment(valor),
      });
    } else {
      if (jogo.placar2 + valor < 0) return;
      await updateDoc(jogoRef, {
        placar2: increment(valor),
      });
    }
  }

  async function mudarStatus(id, status) {
    const jogoRef = doc(db, 'jogos', id);

    if (status === 'INTERVALO') {
      await updateDoc(jogoRef, {
        status: 'AO VIVO',
        intervalo: true,
      });
      return;
    }

    await updateDoc(jogoRef, {
      status: status,
      intervalo: false,
    });
  }

  async function adicionarAcrescimo(id, segundos) {
    const jogoRef = doc(db, 'jogos', id);

    await updateDoc(jogoRef, {
      acrescimo: increment(segundos),
      tempo: increment(segundos),
    });
  }

  async function proximoPeriodo(id) {
    const jogo = jogos.find((j) => j.id === id);
    if (!jogo) return;

    const jogoRef = doc(db, 'jogos', id);

    await updateDoc(jogoRef, {
      periodo: jogo.periodo + 1,
      tempo: jogo.tempoOriginal,
      acrescimo: 0,
      status: 'PRÓXIMO',
      intervalo: false,
    });
  }

  async function adicionarSet(id, lado) {
    const jogo = jogos.find((j) => j.id === id);
    if (!jogo) return;

    const jogoRef = doc(db, 'jogos', id);

    if (lado === 1) {
      await updateDoc(jogoRef, {
        sets1: jogo.sets1 + 1,
        placar1: 0,
        placar2: 0,
      });
    } else {
      await updateDoc(jogoRef, {
        sets2: jogo.sets2 + 1,
        placar1: 0,
        placar2: 0,
      });
    }
  }

  async function excluirJogo(id) {
    const jogoRef = doc(db, 'jogos', id);

    await deleteDoc(jogoRef);
  }

  // ===== Grupos do Futsal =====

  function criarGrupo() {
    const nome = novoNomeGrupo.trim();

    if (!nome) {
      Alert.alert('Digite o nome do grupo');
      return;
    }

    const jaExiste = gruposFutsal.some(
      (g) => g.nome.toLowerCase() === nome.toLowerCase()
    );

    if (jaExiste) {
      Alert.alert('Já existe um grupo com esse nome');
      return;
    }

    addDoc(collection(db, 'gruposFutsal'), { nome, times: [], jogadoresPorTime: {} });
    setNovoNomeGrupo('');
  }

  async function excluirGrupo(grupoId) {
    const grupoRef = doc(db, 'gruposFutsal', grupoId);
    await deleteDoc(grupoRef);
  }

  async function adicionarTimeAoGrupo(grupoId) {
    const grupo = gruposFutsal.find((g) => g.id === grupoId);
    if (!grupo) return;

    const nomeTime = (timeInputPorGrupo[grupoId] || '').trim();

    if (!nomeTime) {
      Alert.alert('Digite o nome do time');
      return;
    }

    if (grupo.times.includes(nomeTime)) {
      Alert.alert('Esse time já está no grupo');
      return;
    }

    const grupoRef = doc(db, 'gruposFutsal', grupoId);
    await updateDoc(grupoRef, { times: [...grupo.times, nomeTime] });

    setTimeInputPorGrupo((prev) => ({ ...prev, [grupoId]: '' }));
  }

  async function removerTimeDoGrupo(grupoId, nomeTime) {
    const grupo = gruposFutsal.find((g) => g.id === grupoId);
    if (!grupo) return;

    const grupoRef = doc(db, 'gruposFutsal', grupoId);
    const jogadoresPorTime = { ...(grupo.jogadoresPorTime || {}) };
    delete jogadoresPorTime[nomeTime];

    await updateDoc(grupoRef, {
      times: grupo.times.filter((t) => t !== nomeTime),
      jogadoresPorTime,
    });
  }

  // ===== Jogadores por time (Futsal) =====

  function obterJogadoresDoTime(nomeTime) {
    for (const grupo of gruposFutsal) {
      const lista = (grupo.jogadoresPorTime || {})[nomeTime];
      if (lista && lista.length > 0) return lista;
    }
    return [];
  }

  function encontrarGrupoDoTime(nomeTime) {
    return gruposFutsal.find((g) => (g.times || []).includes(nomeTime));
  }

  async function adicionarJogador(grupoId, nomeTime, nomeJogadorBruto) {
    const grupo = gruposFutsal.find((g) => g.id === grupoId);
    if (!grupo) return;

    const nomeJogador = (nomeJogadorBruto || '').trim();
    if (!nomeJogador) {
      Alert.alert('Digite o nome do jogador');
      return;
    }

    const listaAtual = (grupo.jogadoresPorTime || {})[nomeTime] || [];

    if (listaAtual.some((j) => j.toLowerCase() === nomeJogador.toLowerCase())) {
      Alert.alert('Esse jogador já está cadastrado nesse time');
      return;
    }

    const jogadoresPorTime = {
      ...(grupo.jogadoresPorTime || {}),
      [nomeTime]: [...listaAtual, nomeJogador],
    };

    const grupoRef = doc(db, 'gruposFutsal', grupoId);
    await updateDoc(grupoRef, { jogadoresPorTime });
  }

  async function removerJogador(grupoId, nomeTime, nomeJogador) {
    const grupo = gruposFutsal.find((g) => g.id === grupoId);
    if (!grupo) return;

    const listaAtual = (grupo.jogadoresPorTime || {})[nomeTime] || [];

    const jogadoresPorTime = {
      ...(grupo.jogadoresPorTime || {}),
      [nomeTime]: listaAtual.filter((j) => j !== nomeJogador),
    };

    const grupoRef = doc(db, 'gruposFutsal', grupoId);
    await updateDoc(grupoRef, { jogadoresPorTime });
  }

  // ===== Gols com artilheiro (Futsal) =====

  function abrirSelecaoDeGol(jogoId, lado, nomeTime) {
    const jogadores = obterJogadoresDoTime(nomeTime);

    if (jogadores.length === 0) {
      // Time sem elenco cadastrado: soma o gol normalmente, sem artilheiro.
      registrarGol(jogoId, lado, nomeTime, null);
      return;
    }

    setModalGolInfo({ jogoId, lado, nomeTime, jogadores });
  }

  async function registrarGol(jogoId, lado, nomeTime, nomeJogador) {
    const jogo = jogos.find((j) => j.id === jogoId);
    if (!jogo) return;

    const jogoRef = doc(db, 'jogos', jogoId);
    const golsAtuais = jogo.golsDetalhados || [];

    await updateDoc(jogoRef, {
      [lado === 1 ? 'placar1' : 'placar2']: increment(1),
      golsDetalhados: [...golsAtuais, { time: nomeTime, jogador: nomeJogador }],
    });

    setModalGolInfo(null);
  }

  async function desfazerUltimoGol(jogoId, lado, nomeTime) {
    const jogo = jogos.find((j) => j.id === jogoId);
    if (!jogo) return;

    const placarAtual = lado === 1 ? jogo.placar1 : jogo.placar2;
    if (placarAtual <= 0) return;

    const golsAtuais = jogo.golsDetalhados || [];
    let idxRemover = -1;
    for (let i = golsAtuais.length - 1; i >= 0; i--) {
      if (golsAtuais[i].time === nomeTime) {
        idxRemover = i;
        break;
      }
    }

    const novaLista =
      idxRemover === -1
        ? golsAtuais
        : golsAtuais.filter((_, i) => i !== idxRemover);

    const jogoRef = doc(db, 'jogos', jogoId);

    await updateDoc(jogoRef, {
      [lado === 1 ? 'placar1' : 'placar2']: increment(-1),
      golsDetalhados: novaLista,
    });
  }

  // ===== Artilheiros =====

  function calcularArtilheiros() {
    const contagem = new Map();

    jogos.forEach((jogo) => {
      (jogo.golsDetalhados || []).forEach((g) => {
        if (!g.jogador) return;
        const chave = g.jogador + '|' + g.time;
        if (!contagem.has(chave)) {
          contagem.set(chave, { jogador: g.jogador, time: g.time, gols: 0 });
        }
        contagem.get(chave).gols += 1;
      });
    });

    return Array.from(contagem.values()).sort((a, b) => b.gols - a.gols);
  }

  function renderTelaArtilheiros() {
    const artilheiros = calcularArtilheiros();

    return (
      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <View style={styles.classificacaoBox}>
            <Text style={styles.classificacaoTitulo}>⚽ Artilheiros</Text>

            {artilheiros.length === 0 ? (
              <Text style={styles.semJogos}>
                Nenhum gol com artilheiro registrado ainda.
              </Text>
            ) : (
              artilheiros.map((item, index) => (
                <View
                  key={item.jogador + '|' + item.time}
                  style={styles.tabelaLinha}
                >
                  <Text style={[styles.tdTime, { flex: 2 }]}>
                    {index + 1}º {item.jogador}{' '}
                    <Text style={{ color: '#888', fontSize: 12 }}>
                      ({item.time})
                    </Text>
                  </Text>
                  <Text style={styles.td}>{item.gols}</Text>
                </View>
              ))
            )}
          </View>
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    );
  }

  // ===== Mata-mata automático (Futsal) =====

  async function gerarMataMataAutomatico() {
    const gruposOrdenados = gruposFutsal
      .slice()
      .sort((a, b) => a.nome.localeCompare(b.nome));

    if (gruposOrdenados.length < 2) {
      Alert.alert(
        'Grupos insuficientes',
        'Você precisa de pelo menos 2 grupos (ex: A e B) para gerar o mata-mata automático.'
      );
      return;
    }

    const grupoA = gruposOrdenados[0];
    const grupoB = gruposOrdenados[1];

    const classA = calcularClassificacaoPorModalidade('Futsal', grupoA.nome);
    const classB = calcularClassificacaoPorModalidade('Futsal', grupoB.nome);

    if (classA.length < 2 || classB.length < 2) {
      Alert.alert(
        'Classificação incompleta',
        `Cada grupo precisa ter pelo menos 2 times com jogos finalizados. Grupo ${grupoA.nome} tem ${classA.length} e Grupo ${grupoB.nome} tem ${classB.length}.`
      );
      return;
    }

    const rotulo = novoRotuloMataMata.trim() || 'Semifinal';
    const minutos = Number(novoTempo) || 10;

    const confrontos = [
      { time1: classA[0].time, time2: classB[1].time },
      { time1: classB[0].time, time2: classA[1].time },
    ];

    for (const confronto of confrontos) {
      const novoJogo = {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
        modalidade: 'Futsal',
        time1: confronto.time1,
        time2: confronto.time2,
        placar1: 0,
        placar2: 0,
        status: 'PRÓXIMO',
        tempo: minutos * 60,
        tempoOriginal: minutos * 60,
        intervalo: false,
        acrescimo: 0,
        emAcrescimo: false,
        periodo: 1,
        sets1: 0,
        sets2: 0,
        fase: 'mata-mata',
        grupo: null,
        faseMataMata: rotulo,
        golsDetalhados: [],
      };

      await addDoc(collection(db, 'jogos'), novoJogo);
    }

    Alert.alert(
      'Mata-mata gerado! 🏆',
      `${rotulo}:\n\n1º ${grupoA.nome} (${confrontos[0].time1}) x 2º ${grupoB.nome} (${confrontos[0].time2})\n1º ${grupoB.nome} (${confrontos[1].time1}) x 2º ${grupoA.nome} (${confrontos[1].time2})\n\nOs jogos foram criados na aba "Jogos".`
    );

    setNovoRotuloMataMata('');
  }

  // ===== Classificação =====

  function calcularClassificacaoPorModalidade(modalidade, grupo = null) {
    const tabela = {};

    jogos
      .filter((jogo) => {
        if (jogo.status !== 'FINALIZADO') return false;
        if (jogo.modalidade !== modalidade) return false;

        if (modalidade === 'Futsal') {
          // mata-mata nunca entra na tabela de pontos
          if (jogo.fase !== 'grupos') return false;
          if (grupo !== null && jogo.grupo !== grupo) return false;
        }

        return true;
      })
      .forEach((jogo) => {
        const time1 = jogo.time1;
        const time2 = jogo.time2;

        if (!tabela[time1]) {
          tabela[time1] = {
            time: time1,
            pts: 0,
            jogos: 0,
            v: 0,
            e: 0,
            d: 0,
            sg: 0,
          };
        }

        if (!tabela[time2]) {
          tabela[time2] = {
            time: time2,
            pts: 0,
            jogos: 0,
            v: 0,
            e: 0,
            d: 0,
            sg: 0,
          };
        }

        const pontos1 = modalidade === 'Vôlei' ? jogo.sets1 : jogo.placar1;
        const pontos2 = modalidade === 'Vôlei' ? jogo.sets2 : jogo.placar2;

        tabela[time1].jogos += 1;
        tabela[time2].jogos += 1;

        tabela[time1].sg += pontos1 - pontos2;
        tabela[time2].sg += pontos2 - pontos1;

        if (pontos1 > pontos2) {
          tabela[time1].pts += 3;
          tabela[time1].v += 1;
          tabela[time2].d += 1;
        } else if (pontos2 > pontos1) {
          tabela[time2].pts += 3;
          tabela[time2].v += 1;
          tabela[time1].d += 1;
        } else {
          tabela[time1].pts += 1;
          tabela[time2].pts += 1;
          tabela[time1].e += 1;
          tabela[time2].e += 1;
        }
      });

    return Object.values(tabela).sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      return b.sg - a.sg;
    });
  }

  function renderClassificacaoModalidade(
    modalidade,
    emoji,
    grupo = null,
    tituloExtra = ''
  ) {
    const tabela = calcularClassificacaoPorModalidade(modalidade, grupo);

    return (
      <View style={styles.classificacaoBox}>
        <Text style={styles.classificacaoTitulo}>
          {emoji} {modalidade}
          {tituloExtra}
        </Text>

        <View style={styles.tabelaHeader}>
          <Text style={[styles.th, { flex: 2 }]}>TIME</Text>
          <Text style={styles.th}>PTS</Text>
          <Text style={styles.th}>J</Text>
          <Text style={styles.th}>V</Text>
          <Text style={styles.th}>E</Text>
          <Text style={styles.th}>D</Text>
          <Text style={styles.th}>SG</Text>
        </View>

        {tabela.length === 0 ? (
          <Text style={styles.semJogos}>Nenhum jogo finalizado ainda.</Text>
        ) : (
          tabela.map((item, index) => (
            <View
              key={item.time}
              style={[
                styles.tabelaLinha,
                grupo !== null && index < 2 && styles.linhaClassificado,
              ]}
            >
              <Text style={[styles.tdTime, { flex: 2 }]}>
                {index + 1}º {item.time}
              </Text>
              <Text style={styles.td}>{item.pts}</Text>
              <Text style={styles.td}>{item.jogos}</Text>
              <Text style={styles.td}>{item.v}</Text>
              <Text style={styles.td}>{item.e}</Text>
              <Text style={styles.td}>{item.d}</Text>
              <Text style={styles.td}>{item.sg}</Text>
            </View>
          ))
        )}

        {grupo !== null && tabela.length > 0 && (
          <Text style={styles.legendaClassificado}>
            🟢 Classificado para o mata-mata
          </Text>
        )}
      </View>
    );
  }

  function renderTelaClassificacao() {
    const gruposOrdenados = gruposFutsal
      .slice()
      .sort((a, b) => a.nome.localeCompare(b.nome));

    return (
      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <View>
            {gruposOrdenados.length === 0
              ? renderClassificacaoModalidade('Futsal', '⚽')
              : gruposOrdenados.map((grupo) => (
                  <View key={grupo.id}>
                    {renderClassificacaoModalidade(
                      'Futsal',
                      '⚽',
                      grupo.nome,
                      ` - Grupo ${grupo.nome}`
                    )}
                  </View>
                ))}

            {renderClassificacaoModalidade('Basquete', '🏀')}
            {renderClassificacaoModalidade('Vôlei', '🏐')}
          </View>
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    );
  }

  // ===== Aba Grupos =====

  function renderTelaGrupos() {
    const gruposOrdenados = gruposFutsal
      .slice()
      .sort((a, b) => a.nome.localeCompare(b.nome));

    return (
      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <View>
            {organizadorLogado ? (
              <View style={styles.organizadorBox}>
                <Text style={styles.loginTitulo}>Criar novo grupo</Text>

                <View style={styles.loginLinha}>
                  <TextInput
                    style={styles.inputSenha}
                    placeholder="Nome do grupo (ex: A)"
                    placeholderTextColor="#999"
                    value={novoNomeGrupo}
                    onChangeText={setNovoNomeGrupo}
                  />

                  <TouchableOpacity
                    style={styles.botaoEntrar}
                    onPress={criarGrupo}
                  >
                    <Text style={styles.botaoEntrarTexto}>Criar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.organizadorBox}>
                <Text style={styles.semJogos}>
                  Faça login como organizador na aba Jogos para criar e
                  editar os grupos.
                </Text>
              </View>
            )}

            {organizadorLogado && gruposOrdenados.length >= 2 && (
              <View style={styles.organizadorBox}>
                <Text style={styles.loginTitulo}>Gerar Mata-Mata Automático</Text>

                <Text style={[styles.semJogos, { marginBottom: 10 }]}>
                  Cria as semifinais cruzando o 1º e 2º colocado dos dois
                  primeiros grupos (ex: 1ºA x 2ºB e 1ºB x 2ºA), com base na
                  classificação atual.
                </Text>

                <View style={styles.loginLinha}>
                  <TextInput
                    style={styles.inputSenha}
                    placeholder='Rótulo (ex: Semifinal)'
                    placeholderTextColor="#999"
                    value={novoRotuloMataMata}
                    onChangeText={setNovoRotuloMataMata}
                  />

                  <TouchableOpacity
                    style={styles.botaoEntrar}
                    onPress={gerarMataMataAutomatico}
                  >
                    <Text style={styles.botaoEntrarTexto}>Gerar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {gruposOrdenados.length === 0 ? (
              <Text style={styles.semJogos}>Nenhum grupo criado ainda.</Text>
            ) : (
              gruposOrdenados.map((grupo) => (
                <View key={grupo.id} style={styles.classificacaoBox}>
                  <View style={styles.topoCard}>
                    <Text style={styles.classificacaoTitulo}>
                      Grupo {grupo.nome}
                    </Text>

                    {organizadorLogado && (
                      <TouchableOpacity onPress={() => excluirGrupo(grupo.id)}>
                        <Text style={styles.excluirTexto}>EXCLUIR</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {grupo.times.length === 0 ? (
                    <Text style={styles.semJogos}>
                      Nenhum time neste grupo ainda.
                    </Text>
                  ) : (
                    grupo.times.map((time) => {
                      const jogadoresDoTime =
                        (grupo.jogadoresPorTime || {})[time] || [];

                      return (
                        <View key={time} style={styles.timeComJogadoresBox}>
                          <View style={styles.timeNoGrupoLinha}>
                            <Text style={styles.tdTime}>{time}</Text>

                            {organizadorLogado && (
                              <TouchableOpacity
                                onPress={() =>
                                  removerTimeDoGrupo(grupo.id, time)
                                }
                              >
                                <Text style={styles.removerTimeTexto}>
                                  remover time
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>

                          {jogadoresDoTime.length === 0 ? (
                            <Text style={styles.semJogadoresTexto}>
                              Nenhum jogador cadastrado.
                            </Text>
                          ) : (
                            <View style={styles.sugestoesLinha}>
                              {jogadoresDoTime.map((jogador) => (
                                <View
                                  key={jogador}
                                  style={styles.jogadorChip}
                                >
                                  <Text style={styles.jogadorChipTexto}>
                                    {jogador}
                                  </Text>

                                  {organizadorLogado && (
                                    <TouchableOpacity
                                      onPress={() =>
                                        removerJogador(
                                          grupo.id,
                                          time,
                                          jogador
                                        )
                                      }
                                    >
                                      <Text style={styles.jogadorChipRemover}>
                                        {' '}
                                        ✕
                                      </Text>
                                    </TouchableOpacity>
                                  )}
                                </View>
                              ))}
                            </View>
                          )}

                          {organizadorLogado && (
                            <View style={styles.loginLinha}>
                              <TextInput
                                style={styles.inputSenha}
                                placeholder="Nome do jogador"
                                placeholderTextColor="#999"
                                value={jogadorInputPorTime[time] || ''}
                                onChangeText={(texto) =>
                                  setJogadorInputPorTime((prev) => ({
                                    ...prev,
                                    [time]: texto,
                                  }))
                                }
                              />

                              <TouchableOpacity
                                style={styles.botaoEntrar}
                                onPress={() => {
                                  adicionarJogador(
                                    grupo.id,
                                    time,
                                    jogadorInputPorTime[time]
                                  );
                                  setJogadorInputPorTime((prev) => ({
                                    ...prev,
                                    [time]: '',
                                  }));
                                }}
                              >
                                <Text style={styles.botaoEntrarTexto}>
                                  + Jogador
                                </Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      );
                    })
                  )}

                  {organizadorLogado && (
                    <View style={[styles.loginLinha, { marginTop: 10 }]}>
                      <TextInput
                        style={styles.inputSenha}
                        placeholder="Nome do time"
                        placeholderTextColor="#999"
                        value={timeInputPorGrupo[grupo.id] || ''}
                        onChangeText={(texto) =>
                          setTimeInputPorGrupo((prev) => ({
                            ...prev,
                            [grupo.id]: texto,
                          }))
                        }
                      />

                      <TouchableOpacity
                        style={styles.botaoEntrar}
                        onPress={() => adicionarTimeAoGrupo(grupo.id)}
                      >
                        <Text style={styles.botaoEntrarTexto}>+ Time</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    );
  }

  // ===== Aba Jogos =====

  function renderCentro(item) {
    if (item.modalidade === 'Vôlei') {
      return (
        <View style={styles.centro}>
          <Text style={styles.setsTitulo}>SETS</Text>

          <Text style={styles.setsTexto}>
            {item.sets1} x {item.sets2}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.centro}>
        {item.modalidade === 'Basquete' && (
          <Text style={styles.periodoTexto}>{item.periodo}º PERÍODO</Text>
        )}

        {item.intervalo && <Text style={styles.intervaloTexto}>INTERVALO</Text>}

        {item.status === 'AO VIVO' && (
          <Text style={styles.timer}>{formatarTempo(item.tempo)}</Text>
        )}

        {item.modalidade === 'Futsal' && item.acrescimo > 0 && (
          <Text style={styles.acrescimoTexto}>
            +{Math.floor(item.acrescimo / 60)} MIN
          </Text>
        )}
      </View>
    );
  }

  function renderFaseBadge(item) {
    if (item.modalidade !== 'Futsal' || !item.fase) return null;

    const texto =
      item.fase === 'grupos'
        ? `GRUPO ${item.grupo || '?'}`
        : (item.faseMataMata || 'MATA-MATA').toUpperCase();

    return (
      <View style={styles.faseBadge}>
        <Text style={styles.faseBadgeTexto}>{texto}</Text>
      </View>
    );
  }

  function renderJogo({ item }) {
    return (
      <View style={styles.card}>
        <View style={styles.topoCard}>
          <Text style={styles.modalidade}>{item.modalidade}</Text>

          <View
            style={[
              styles.statusBox,
              item.status === 'AO VIVO'
                ? styles.aoVivo
                : item.status === 'FINALIZADO'
                ? styles.finalizado
                : item.status === 'PRÓXIMO'
                ? styles.proximo
                : styles.intervaloStatus,
            ]}
          >
            <Text style={styles.statusTexto}>{item.status}</Text>
          </View>
        </View>

        {renderFaseBadge(item)}

        <View style={styles.placarArea}>
          <View style={styles.timeBox}>
            <Text style={styles.nomeTime}>{item.time1}</Text>
            <Text style={styles.gol}>{item.placar1}</Text>
          </View>

          {renderCentro(item)}

          <View style={styles.timeBox}>
            <Text style={styles.nomeTime}>{item.time2}</Text>
            <Text style={styles.gol}>{item.placar2}</Text>
          </View>
        </View>

        {organizadorLogado && (
          <View style={styles.painel}>
            <View style={styles.linhaPainel}>
              <TouchableOpacity
                style={styles.botao}
                onPress={() =>
                  item.modalidade === 'Futsal'
                    ? abrirSelecaoDeGol(item.id, 1, item.time1)
                    : alterarPlacar(item.id, 1, 1)
                }
              >
                <Text style={styles.botaoTexto}>+ {item.time1}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.botao}
                onPress={() =>
                  item.modalidade === 'Futsal'
                    ? abrirSelecaoDeGol(item.id, 2, item.time2)
                    : alterarPlacar(item.id, 2, 1)
                }
              >
                <Text style={styles.botaoTexto}>+ {item.time2}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.linhaPainel}>
              <TouchableOpacity
                style={styles.botao}
                onPress={() =>
                  item.modalidade === 'Futsal'
                    ? desfazerUltimoGol(item.id, 1, item.time1)
                    : alterarPlacar(item.id, 1, -1)
                }
              >
                <Text style={styles.botaoTexto}>- {item.time1}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.botao}
                onPress={() =>
                  item.modalidade === 'Futsal'
                    ? desfazerUltimoGol(item.id, 2, item.time2)
                    : alterarPlacar(item.id, 2, -1)
                }
              >
                <Text style={styles.botaoTexto}>- {item.time2}</Text>
              </TouchableOpacity>
            </View>

            {item.modalidade === 'Futsal' && (
              <View style={styles.linhaPainel}>
                <TouchableOpacity
                  style={styles.statusBtn}
                  onPress={() => adicionarAcrescimo(item.id, 60)}
                >
                  <Text style={styles.statusBtnTexto}>+1 MIN</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.statusBtn}
                  onPress={() => adicionarAcrescimo(item.id, 300)}
                >
                  <Text style={styles.statusBtnTexto}>+5 MIN</Text>
                </TouchableOpacity>
              </View>
            )}

            {item.modalidade === 'Basquete' && (
              <View style={styles.linhaPainel}>
                <TouchableOpacity
                  style={styles.statusBtn}
                  onPress={() => proximoPeriodo(item.id)}
                >
                  <Text style={styles.statusBtnTexto}>PRÓXIMO PERÍODO</Text>
                </TouchableOpacity>
              </View>
            )}

            {item.modalidade === 'Vôlei' && (
              <View style={styles.linhaPainel}>
                <TouchableOpacity
                  style={styles.statusBtn}
                  onPress={() => adicionarSet(item.id, 1)}
                >
                  <Text style={styles.statusBtnTexto}>+ SET {item.time1}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.statusBtn}
                  onPress={() => adicionarSet(item.id, 2)}
                >
                  <Text style={styles.statusBtnTexto}>+ SET {item.time2}</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.linhaPainel}>
              <TouchableOpacity
                style={styles.statusBtn}
                onPress={() => mudarStatus(item.id, 'AO VIVO')}
              >
                <Text style={styles.statusBtnTexto}>AO VIVO</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.statusBtn}
                onPress={() => mudarStatus(item.id, 'INTERVALO')}
              >
                <Text style={styles.statusBtnTexto}>INTERVALO</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.linhaPainel}>
              <TouchableOpacity
                style={styles.statusBtn}
                onPress={() => mudarStatus(item.id, 'FINALIZADO')}
              >
                <Text style={styles.statusBtnTexto}>FINALIZADO</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.statusBtn}
                onPress={() => mudarStatus(item.id, 'PRÓXIMO')}
              >
                <Text style={styles.statusBtnTexto}>PRÓXIMO</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.excluirBtn}
              onPress={() => excluirJogo(item.id)}
            >
              <Text style={styles.excluirTexto}>EXCLUIR JOGO</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  function renderTelaJogos() {
    return (
      <>
        {!organizadorLogado && mostrarLoginOrganizador && (
          <View style={styles.loginBox}>
            <View style={styles.topoCard}>
              <Text style={styles.loginTitulo}>Área do Organizador</Text>

              <TouchableOpacity
                onPress={() => setMostrarLoginOrganizador(false)}
              >
                <Text style={styles.fecharPainelTexto}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.loginLinha}>
              <TextInput
                style={styles.inputSenha}
                placeholder="Digite a senha"
                placeholderTextColor="#999"
                secureTextEntry
                value={senha}
                onChangeText={setSenha}
              />

              <TouchableOpacity style={styles.botaoEntrar} onPress={loginOrganizador}>
                <Text style={styles.botaoEntrarTexto}>Entrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {organizadorLogado && mostrarLoginOrganizador && (
          <View style={styles.organizadorBox}>
            <View style={styles.topoCard}>
              <Text style={styles.organizadorTitulo}>Painel do Organizador</Text>

              <TouchableOpacity onPress={fecharPainelOrganizador}>
                <Text style={styles.fecharPainelTexto}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Tempo em minutos"
              placeholderTextColor="#999"
              value={novoTempo}
              onChangeText={setNovoTempo}
              keyboardType="numeric"
            />

            <View style={styles.modalidades}>
              {['Futsal', 'Basquete', 'Vôlei'].map((mod) => (
                <TouchableOpacity
                  key={mod}
                  style={[
                    styles.modalidadeBtn,
                    novaModalidade === mod && styles.modalidadeBtnAtivo,
                  ]}
                  onPress={() => setNovaModalidade(mod)}
                >
                  <Text style={styles.modalidadeTexto}>{mod}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {novaModalidade === 'Futsal' && (
              <View style={styles.faseSelecaoBox}>
                <Text style={styles.faseSelecaoTitulo}>Fase</Text>

                <View style={styles.modalidades}>
                  {['grupos', 'mata-mata'].map((f) => (
                    <TouchableOpacity
                      key={f}
                      style={[
                        styles.modalidadeBtn,
                        novaFase === f && styles.modalidadeBtnAtivo,
                      ]}
                      onPress={() => setNovaFase(f)}
                    >
                      <Text style={styles.modalidadeTexto}>
                        {f === 'grupos' ? 'Fase de Grupos' : 'Mata-mata'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {novaFase === 'grupos' &&
                  (gruposFutsal.length === 0 ? (
                    <Text style={styles.semJogos}>
                      Nenhum grupo criado. Crie um grupo na aba "Grupos".
                    </Text>
                  ) : (
                    <View style={styles.gruposSelecaoLinha}>
                      {gruposFutsal
                        .slice()
                        .sort((a, b) => a.nome.localeCompare(b.nome))
                        .map((grupo) => (
                          <TouchableOpacity
                            key={grupo.id}
                            style={[
                              styles.grupoSelecaoBtn,
                              novoGrupoNome === grupo.nome &&
                                styles.modalidadeBtnAtivo,
                            ]}
                            onPress={() => setNovoGrupoNome(grupo.nome)}
                          >
                            <Text style={styles.modalidadeTexto}>
                              Grupo {grupo.nome}
                            </Text>
                          </TouchableOpacity>
                        ))}
                    </View>
                  ))}

                {novaFase === 'mata-mata' && (
                  <TextInput
                    style={styles.input}
                    placeholder='Rótulo (ex: Semifinal, Final)'
                    placeholderTextColor="#999"
                    value={novoRotuloMataMata}
                    onChangeText={setNovoRotuloMataMata}
                  />
                )}
              </View>
            )}

            {(() => {
              const grupoSelecionado = gruposFutsal.find(
                (g) => g.nome === novoGrupoNome
              );

              const usarSelecaoDoGrupo =
                novaModalidade === 'Futsal' &&
                novaFase === 'grupos' &&
                grupoSelecionado &&
                grupoSelecionado.times.length > 0;

              if (usarSelecaoDoGrupo) {
                return (
                  <>
                    <View style={styles.faseSelecaoBox}>
                      <Text style={styles.faseSelecaoTitulo}>Time 1</Text>
                      <View style={styles.gruposSelecaoLinha}>
                        {grupoSelecionado.times
                          .filter((t) => t !== novoTime2)
                          .map((t) => (
                            <TouchableOpacity
                              key={t}
                              style={[
                                styles.grupoSelecaoBtn,
                                novoTime1 === t && styles.modalidadeBtnAtivo,
                              ]}
                              onPress={() => setNovoTime1(t)}
                            >
                              <Text style={styles.modalidadeTexto}>{t}</Text>
                            </TouchableOpacity>
                          ))}
                      </View>
                    </View>

                    <View style={styles.faseSelecaoBox}>
                      <Text style={styles.faseSelecaoTitulo}>Time 2</Text>
                      <View style={styles.gruposSelecaoLinha}>
                        {grupoSelecionado.times
                          .filter((t) => t !== novoTime1)
                          .map((t) => (
                            <TouchableOpacity
                              key={t}
                              style={[
                                styles.grupoSelecaoBtn,
                                novoTime2 === t && styles.modalidadeBtnAtivo,
                              ]}
                              onPress={() => setNovoTime2(t)}
                            >
                              <Text style={styles.modalidadeTexto}>{t}</Text>
                            </TouchableOpacity>
                          ))}
                      </View>
                    </View>
                  </>
                );
              }

              const nomesConhecidos = obterNomesTimesConhecidos(novaModalidade);

              return (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Time 1"
                    placeholderTextColor="#999"
                    value={novoTime1}
                    onChangeText={setNovoTime1}
                  />

                  {nomesConhecidos.length > 0 && (
                    <View style={styles.sugestoesLinha}>
                      {nomesConhecidos.map((nome) => (
                        <TouchableOpacity
                          key={'t1-' + nome}
                          style={styles.sugestaoChip}
                          onPress={() => setNovoTime1(nome)}
                        >
                          <Text style={styles.sugestaoChipTexto}>{nome}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <TextInput
                    style={styles.input}
                    placeholder="Time 2"
                    placeholderTextColor="#999"
                    value={novoTime2}
                    onChangeText={setNovoTime2}
                  />

                  {nomesConhecidos.length > 0 && (
                    <View style={styles.sugestoesLinha}>
                      {nomesConhecidos.map((nome) => (
                        <TouchableOpacity
                          key={'t2-' + nome}
                          style={styles.sugestaoChip}
                          onPress={() => setNovoTime2(nome)}
                        >
                          <Text style={styles.sugestaoChipTexto}>{nome}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </>
              );
            })()}

            <TouchableOpacity style={styles.criarBtn} onPress={criarJogo}>
              <Text style={styles.criarTexto}>CRIAR JOGO</Text>
            </TouchableOpacity>
          </View>
        )}

        <FlatList
          data={ordenarJogosPorStatus(jogos)}
          keyExtractor={(item) => item.id}
          renderItem={renderJogo}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      </>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.cabecalhoLinha}>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>🏆 INTERCLASSE CEETIM PAULO FREIRE</Text>
          <Text style={styles.subtitulo}>Placar esportivo em tempo real</Text>
        </View>

        <TouchableOpacity
          style={styles.menuHamburguerBtn}
          onPress={() => {
            setAbaAtual('jogos');
            setMostrarLoginOrganizador((v) => !v);
          }}
        >
          <Text style={styles.menuHamburguerTexto}>☰</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.conteudo}>
        {abaAtual === 'jogos'
          ? renderTelaJogos()
          : abaAtual === 'classificacao'
          ? renderTelaClassificacao()
          : organizadorLogado
          ? renderTelaGrupos()
          : renderTelaArtilheiros()}
      </View>

      <View style={styles.abas}>
        <TouchableOpacity
          style={[styles.abaBotao, abaAtual === 'jogos' && styles.abaAtiva]}
          onPress={() => setAbaAtual('jogos')}
        >
          <Text
            style={[
              styles.abaTexto,
              abaAtual === 'jogos' && styles.abaTextoAtivo,
            ]}
          >
            Jogos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.abaBotao,
            abaAtual === 'classificacao' && styles.abaAtiva,
          ]}
          onPress={() => setAbaAtual('classificacao')}
        >
          <Text
            style={[
              styles.abaTexto,
              abaAtual === 'classificacao' && styles.abaTextoAtivo,
            ]}
          >
            Classificação
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.abaBotao, abaAtual === 'grupos' && styles.abaAtiva]}
          onPress={() => setAbaAtual('grupos')}
        >
          <Text
            style={[
              styles.abaTexto,
              abaAtual === 'grupos' && styles.abaTextoAtivo,
            ]}
          >
            {organizadorLogado ? 'Grupos' : 'Artilheiros'}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={modalGolInfo !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setModalGolInfo(null)}
      >
        <View style={styles.modalFundo}>
          <View style={styles.modalCaixa}>
            <Text style={styles.loginTitulo}>
              Quem marcou? ({modalGolInfo?.nomeTime})
            </Text>

            <View style={styles.sugestoesLinha}>
              {(modalGolInfo?.jogadores || []).map((jogador) => (
                <TouchableOpacity
                  key={jogador}
                  style={styles.sugestaoChip}
                  onPress={() =>
                    registrarGol(
                      modalGolInfo.jogoId,
                      modalGolInfo.lado,
                      modalGolInfo.nomeTime,
                      jogador
                    )
                  }
                >
                  <Text style={styles.sugestaoChipTexto}>{jogador}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.botaoEntrar, { marginTop: 14 }]}
              onPress={() =>
                registrarGol(
                  modalGolInfo.jogoId,
                  modalGolInfo.lado,
                  modalGolInfo.nomeTime,
                  null
                )
              }
            >
              <Text style={styles.botaoEntrarTexto}>Não sei / sem artilheiro</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ marginTop: 12, alignSelf: 'center' }}
              onPress={() => setModalGolInfo(null)}
            >
              <Text style={{ color: '#888' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#03140a',
    paddingTop: 60,
    paddingHorizontal: 16,
  },

  conteudo: {
    flex: 1,
  },

  cabecalhoLinha: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  menuHamburguerBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 8,
  },

  menuHamburguerTexto: {
    color: '#22c55e',
    fontSize: 26,
    fontWeight: '900',
  },

  fecharPainelTexto: {
    color: '#f87171',
    fontSize: 18,
    fontWeight: '900',
    paddingHorizontal: 6,
  },

  titulo: {
    color: '#22c55e',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },

  subtitulo: {
    color: '#aaa',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
  },

  loginBox: {
    backgroundColor: '#052e16',
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
  },

  loginTitulo: {
    color: '#22c55e',
    fontWeight: '800',
    fontSize: 16,
    marginBottom: 10,
  },

  loginLinha: {
    flexDirection: 'row',
    gap: 8,
  },

  inputSenha: {
    flex: 1,
    backgroundColor: '#0b1f14',
    color: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
  },

  botaoEntrar: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 12,
  },

  botaoEntrarTexto: {
    color: '#052e16',
    fontWeight: '900',
  },

  organizadorBox: {
    backgroundColor: '#052e16',
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
  },

  organizadorTitulo: {
    color: '#22c55e',
    fontWeight: '900',
    fontSize: 18,
    marginBottom: 12,
  },

  input: {
    backgroundColor: '#0b1f14',
    color: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },

  modalidades: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  modalidadeBtn: {
    backgroundColor: '#0b1f14',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },

  modalidadeBtnAtivo: {
    backgroundColor: '#22c55e',
  },

  modalidadeTexto: {
    color: '#fff',
    fontWeight: '700',
  },

  faseSelecaoBox: {
    backgroundColor: '#0b1f14',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },

  faseSelecaoTitulo: {
    color: '#22c55e',
    fontWeight: '800',
    fontSize: 13,
    marginBottom: 8,
  },

  sugestoesLinha: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },

  sugestaoChip: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 14,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },

  sugestaoChipTexto: {
    color: '#ccc',
    fontSize: 12,
  },

  gruposSelecaoLinha: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  grupoSelecaoBtn: {
    backgroundColor: '#052e16',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },

  criarBtn: {
    backgroundColor: '#22c55e',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },

  criarTexto: {
    color: '#052e16',
    fontWeight: '900',
  },

  classificacaoBox: {
    backgroundColor: '#052e16',
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
  },

  classificacaoTitulo: {
    color: '#22c55e',
    fontWeight: '900',
    fontSize: 18,
    marginBottom: 10,
  },

  semJogos: {
    color: '#aaa',
    fontWeight: '700',
    marginTop: 8,
  },

  tabelaHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#14532d',
    paddingBottom: 6,
    marginBottom: 6,
  },

  tabelaLinha: {
    flexDirection: 'row',
    paddingVertical: 5,
  },

  linhaClassificado: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 4,
  },

  legendaClassificado: {
    color: '#22c55e',
    fontWeight: '700',
    fontSize: 11,
    marginTop: 8,
  },

  th: {
    flex: 1,
    color: '#22c55e',
    fontWeight: '900',
    fontSize: 11,
    textAlign: 'center',
  },

  td: {
    flex: 1,
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'center',
  },

  tdTime: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
  },

  timeNoGrupoLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#0b1f14',
  },

  timeComJogadoresBox: {
    borderBottomWidth: 1,
    borderBottomColor: '#0b1f14',
    paddingBottom: 10,
    marginBottom: 10,
  },

  semJogadoresTexto: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 6,
  },

  jogadorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#132a1c',
    borderWidth: 1,
    borderColor: '#1f4a30',
    borderRadius: 14,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },

  jogadorChipTexto: {
    color: '#d1fae5',
    fontSize: 12,
  },

  jogadorChipRemover: {
    color: '#f87171',
    fontWeight: '800',
    fontSize: 12,
  },

  modalFundo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  modalCaixa: {
    backgroundColor: '#0b1f14',
    borderRadius: 14,
    padding: 20,
    width: '100%',
    maxWidth: 420,
  },

  removerTimeTexto: {
    color: '#f87171',
    fontWeight: '800',
    fontSize: 11,
  },

  card: {
    backgroundColor: '#071a0f',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },

  topoCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },

  modalidade: {
    color: '#22c55e',
    fontWeight: '800',
    fontSize: 16,
  },

  statusBox: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },

  aoVivo: {
    backgroundColor: '#dc2626',
  },

  finalizado: {
    backgroundColor: '#374151',
  },

  proximo: {
    backgroundColor: '#2563eb',
  },

  intervaloStatus: {
    backgroundColor: '#f59e0b',
  },

  statusTexto: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 11,
  },

  faseBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#0b1f14',
    borderWidth: 1,
    borderColor: '#22c55e',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: -8,
    marginBottom: 14,
  },

  faseBadgeTexto: {
    color: '#22c55e',
    fontWeight: '800',
    fontSize: 11,
  },

  placarArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  timeBox: {
    flex: 1,
    alignItems: 'center',
  },

  nomeTime: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },

  gol: {
    color: '#22c55e',
    fontSize: 42,
    fontWeight: '900',
  },

  centro: {
    width: 110,
    alignItems: 'center',
  },

  timer: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
  },

  intervaloTexto: {
    color: '#f59e0b',
    fontWeight: '900',
    marginBottom: 4,
  },

  acrescimoTexto: {
    color: '#f59e0b',
    marginTop: 4,
    fontWeight: '900',
  },

  periodoTexto: {
    color: '#60a5fa',
    fontWeight: '900',
    marginBottom: 6,
  },

  setsTitulo: {
    color: '#f59e0b',
    fontWeight: '900',
    marginBottom: 4,
  },

  setsTexto: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
  },

  painel: {
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#123524',
    paddingTop: 14,
  },

  linhaPainel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  botao: {
    flex: 1,
    flexBasis: 0,
    backgroundColor: '#14532d',
    marginHorizontal: 4,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },

  botaoTexto: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },

  statusBtn: {
    flex: 1,
    backgroundColor: '#1f2937',
    marginHorizontal: 3,
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },

  statusBtnTexto: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 11,
    textAlign: 'center',
  },

  excluirBtn: {
    backgroundColor: '#7f1d1d',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6,
  },

  excluirTexto: {
    color: '#fff',
    fontWeight: '900',
  },

  abas: {
    position: 'absolute',
    bottom: 18,
    left: 16,
    right: 16,
    backgroundColor: '#052e16',
    borderRadius: 18,
    flexDirection: 'row',
    padding: 6,
  },

  abaBotao: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },

  abaAtiva: {
    backgroundColor: '#22c55e',
  },

  abaTexto: {
    color: '#aaa',
    fontWeight: '900',
  },

  abaTextoAtivo: {
    color: '#052e16',
  },
});