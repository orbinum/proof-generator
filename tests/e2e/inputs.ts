/**
 * Circuit inputs for the end-to-end proofs, copied from the `circuits`
 * repository's own fixtures.
 *
 * Inlined rather than read from a sibling checkout: `@orbinum/circuits` ships
 * artifacts, not fixtures, so a test that needed the repository would only run
 * on a machine that happened to have it — which is the same as not running.
 *
 * These are the exact values `circuits` proves against, so a witness built here
 * is the witness built there. If a circuit changes shape, these stop producing a
 * valid witness and the tests fail, which is the correct outcome: the inputs are
 * part of the circuit's contract.
 */
export const CIRCUIT_INPUTS_V1 = {
  unshield: {
    merkle_root: '14208393621753335770025492346046929577284360878008976455860383840052720004891',
    nullifier: '1488218295146882086592806968655647094002237392054888626232339779137708023373',
    amount: '1000',
    recipient: '12302652060646580787',
    asset_id: '0',
    fee: '0',
    change_commitment: '0',
    note_value: '1000',
    note_asset_id: '0',
    note_blinding: '18364757930599072545',
    spending_key: '16045690984503098046',
    change_value: '0',
    change_blinding: '12379813812177893520',
    change_owner_pubkey:
      '13826375473539183646547341604172954507723723664952082089315229524188628057191',
    path_elements: [
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
    ],
    path_indices: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  transfer: {
    merkle_root: '12970531020750660003187142746871537313005853234078955446152176932961321250309',
    nullifiers: [
      '17633781741974926866820890898999796370865407499102248138929531529882894496494',
      '0',
    ],
    commitments: [
      '8473780464478975344710403757137496575262033779180191330019662823202433636764',
      '13958225376165197931574105574776057935119724891089686105150264677701824481933',
    ],
    asset_id: '0',
    fee: '10',
    input_values: ['1000', '0'],
    input_asset_ids: ['0', '0'],
    input_blindings: ['1234605616436508552', '0'],
    spending_keys: ['16045690984503098046', '16045690984503098046'],
    input_path_elements: [
      [
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
      ],
      [
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
      ],
    ],
    input_path_indices: [
      [
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
      ],
      [
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
      ],
    ],
    output_values: ['990', '0'],
    output_asset_ids: ['0', '0'],
    output_owner_pubkeys: ['1229782938247303441', '2459565876494606882'],
    output_blindings: ['12302652056939934532', '6153737369425722316'],
  },
};

/**
 * v2 appends `memo_hash`. The circuit only binds it as a public input — any
 * field element proves — so v2's inputs are v1's plus one.
 */
const MEMO_HASH = '1835363695';

export const CIRCUIT_INPUTS_V2 = {
  unshield: { ...CIRCUIT_INPUTS_V1.unshield, memo_hash: MEMO_HASH },
  transfer: { ...CIRCUIT_INPUTS_V1.transfer, memo_hash: MEMO_HASH },
};

/** Shield has one layout at every version: `circuits`' `fixtures/shield.input.json`. */
export const SHIELD_INPUTS = {
  commitment: '10645047120834773430868535752517399140137084112028900997078331302495914980713',
  value: '1000',
  asset_id: '0',
  owner_pubkey: '13826375473539183646547341604172954507723723664952082089315229524188628057191',
  blinding: '18364757930599072545',
};

/** The inputs for one circuit version. */
export function inputsFor(circuit: 'unshield' | 'transfer' | 'shield', version: number) {
  if (circuit === 'shield') return SHIELD_INPUTS;
  return version === 1 ? CIRCUIT_INPUTS_V1[circuit] : CIRCUIT_INPUTS_V2[circuit];
}
