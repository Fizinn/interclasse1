import { collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
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
} from 'react-native';

export default function App() {
  const senhaOrganizador = 'ceetim2026';

  const [abaAtual, setAbaAtual] = useState('jogos');

  const [organizadorLogado, setOrganizadorLogado] = useState(false);
  const [senha, setSenha] = useState('');

  const [novoTime1, setNovoTime1] = useState('');
  const [novoTime2, setNovoTime2] = useState('');
  const [novoTempo, setNovoTempo] = useState('10');
  const [novaModalidade, setNovaModalidade] = useState('Futsal');

  const [jogos, setJogos] = useState([]);


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


// COLA AQUI 👇

useEffect(() => {

  const timer = setInterval(() => {
    jogos.forEach(async (jogo) => {
      if (jogo.modalidade === 'Vôlei') return;
      if (jogo.status !== 'AO VIVO') return;
      if (jogo.intervalo) return;
      if (jogo.tempo <= 0) return;

      const jogoRef = doc(db, 'jogos', jogo.id);

      await updateDoc(jogoRef, {
        tempo: jogo.tempo - 1,
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

  function loginOrganizador() {
    if (senha === senhaOrganizador) {
      setOrganizadorLogado(true);
      setSenha('');
    } else {
      Alert.alert('Senha incorreta');
    }
  }

  function criarJogo() {
    if (!novoTime1 || !novoTime2) {
      Alert.alert('Preencha os times');
      return;
    }

    const minutos = Number(novoTempo);

    const novoJogo = {
      id: Date.now().toString(),
      modalidade: novaModalidade,
      time1: novoTime1,
      time2: novoTime2,
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
    };

    addDoc(collection(db, 'jogos'), novoJogo);              

    setNovoTime1('');
    setNovoTime2('');
    setNovoTempo('10');
  }

 
  async function alterarPlacar(id, lado, valor) {
  const jogo = jogos.find((j) => j.id === id);
  if (!jogo) return;

  const jogoRef = doc(db, 'jogos', id);

  if (lado === 1) {
    await updateDoc(jogoRef, {
      placar1: Math.max(0, jogo.placar1 + valor),
    });
  } else {
    await updateDoc(jogoRef, {
      placar2: Math.max(0, jogo.placar2 + valor),
    });
  }
}
async function mudarStatus(id, status) {
  console.log('Mudando status:', id, status);

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
  const jogo = jogos.find((j) => j.id === id);
  if (!jogo) return;

  const jogoRef = doc(db, 'jogos', id);

  await updateDoc(jogoRef, {
    acrescimo: jogo.acrescimo + segundos,
    tempo: jogo.tempo + segundos,
  });
}

  async function proximoPeriodo(id) {
  const jogo = jogos.find((j) => j.id === id);
  if (!jogo) return;

  const jogoRef = doc(db, 'jogos', id);

  await updateDoc(jogoRef, {
    periodo: jogo.periodo + 1,
    tempo: jogo.tempoOriginal,
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
  function calcularClassificacaoPorModalidade(modalidade) {
    const tabela = {};

    jogos
      .filter(
        (jogo) =>
          jogo.status === 'FINALIZADO' && jogo.modalidade === modalidade
      )
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

  function renderClassificacaoModalidade(modalidade, emoji) {
    const tabela = calcularClassificacaoPorModalidade(modalidade);

    return (
      <View style={styles.classificacaoBox}>
        <Text style={styles.classificacaoTitulo}>
          {emoji} {modalidade}
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
            <View key={item.time} style={styles.tabelaLinha}>
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
      </View>
    );
  }

  function renderTelaClassificacao() {
    return (
      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <View>
            {renderClassificacaoModalidade('Futsal', '⚽')}
            {renderClassificacaoModalidade('Basquete', '🏀')}
            {renderClassificacaoModalidade('Vôlei', '🏐')}
          </View>
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    );
  }

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
                onPress={() => alterarPlacar(item.id, 1, 1)}
              >
                <Text style={styles.botaoTexto}>+ {item.time1}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.botao}
                onPress={() => alterarPlacar(item.id, 2, 1)}
              >
                <Text style={styles.botaoTexto}>+ {item.time2}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.linhaPainel}>
              <TouchableOpacity
                style={styles.botao}
                onPress={() => alterarPlacar(item.id, 1, -1)}
              >
                <Text style={styles.botaoTexto}>- {item.time1}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.botao}
                onPress={() => alterarPlacar(item.id, 2, -1)}
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
        {!organizadorLogado && (
          <View style={styles.loginBox}>
            <Text style={styles.loginTitulo}>Área do Organizador</Text>

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

        {organizadorLogado && (
          <View style={styles.organizadorBox}>
            <Text style={styles.organizadorTitulo}>Painel do Organizador</Text>

            <TextInput
              style={styles.input}
              placeholder="Time 1"
              placeholderTextColor="#999"
              value={novoTime1}
              onChangeText={setNovoTime1}
            />

            <TextInput
              style={styles.input}
              placeholder="Time 2"
              placeholderTextColor="#999"
              value={novoTime2}
              onChangeText={setNovoTime2}
            />

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

            <TouchableOpacity style={styles.criarBtn} onPress={criarJogo}>
              <Text style={styles.criarTexto}>CRIAR JOGO</Text>
            </TouchableOpacity>
          </View>
        )}

        <FlatList
          data={jogos}
          keyExtractor={(item) => item.id}
          renderItem={renderJogo}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      </>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>🏆 INTERCLASSE CEETIM PAULO FREIRE</Text>

      <Text style={styles.subtitulo}>Placar esportivo em tempo real</Text>

      <View style={styles.conteudo}>
        {abaAtual === 'jogos' ? renderTelaJogos() : renderTelaClassificacao()}
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
      </View>
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